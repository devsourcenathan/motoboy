<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Actions;

use App\Modules\Bookings\Enums\BookingChannel;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Bookings\Models\BookingPassenger;
use App\Modules\Bookings\Support\CancellationTerms;
use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Payments\Actions\RefundPayment;
use App\Modules\Payments\Enums\RefundReason;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payouts\Actions\RecordCancellationSettlement;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Tickets\Enums\TicketStatus;
use App\Modules\Trips\Models\Trip;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Annulation à l'initiative du passager, totale ou partielle (B5).
 *
 * **L'annulation partielle est supportée dès le MVP** : trois places réservées,
 * une annulée. Le remboursement s'applique au niveau du passager et du siège,
 * pas de la réservation entière.
 *
 * Ce qui est payé ne bouge jamais. `total_amount` et `seats_count` restent ce
 * qu'ils étaient : ils décrivent l'encaissement, et les modifier ferait diverger
 * la réservation du paiement qui la couvre. L'annulation vit sur le passager, et
 * le montant rendu vit sur le remboursement.
 */
final class CancelBooking
{
    public function __construct(
        private readonly RefundPayment $refunds,
        private readonly RecordCancellationSettlement $settlement,
    ) {}

    /**
     * @param  list<int>  $passengerIds  Vide pour annuler la réservation entière.
     * @return array{booking: Booking, refund: Refund|null, refunded: int, fee: int, cancelled: list<int>}
     */
    public function handle(Booking $booking, array $passengerIds = [], ?int $initiatedBy = null): array
    {
        $passengers = $this->target($booking, $passengerIds);
        $terms = CancellationTerms::for($booking, $passengers->count());

        if (!$terms->cancellable) {
            throw ApiException::of(
                $terms->refusal ?? ErrorCode::BookingNotCancellable,
                'Cette réservation ne peut plus être annulée.',
                ['deadline_at' => $terms->deadlineAt?->toIso8601String()],
            );
        }

        $refund = DB::transaction(function () use ($booking, $passengers, $terms, $initiatedBy): ?Refund {
            $this->release($booking, $passengers);

            return $this->compensate($booking, $passengers, $terms, $initiatedBy);
        });

        // L'exécution auprès du prestataire est hors transaction : un appel
        // réseau tenu à l'intérieur garderait les verrous du départ ouverts
        // pendant toute sa durée.
        if ($refund !== null) {
            $refund = $this->refunds->execute($refund);
        }

        return [
            'booking' => $booking->refresh(),
            'refund' => $refund,
            'refunded' => $refund === null ? 0 : $refund->amount,
            'fee' => $terms->fee,
            'cancelled' => array_values(array_map(intval(...), $passengers->pluck('id')->all())),
        ];
    }

    /**
     * Libère les places et éteint les billets.
     *
     * `holds_seat` **est** la prise de place : c'est lui que lit l'index unique
     * partiel, donc c'est lui qu'il faut réellement remettre à `false` pour que
     * le siège reparte à la vente (B2).
     *
     * @param  Collection<int, BookingPassenger>  $passengers
     */
    private function release(Booking $booking, Collection $passengers): void
    {
        $ids = $passengers->pluck('id')->all();

        BookingPassenger::query()
            ->whereIn('id', $ids)
            ->update(['status' => 'CANCELLED', 'holds_seat' => false]);

        $booking->tickets()
            ->whereIn('booking_passenger_id', $ids)
            ->update(['status' => TicketStatus::Cancelled]);

        $trip = $booking->trip;

        // En mode capacité, le compteur doit reculer d'autant : c'est lui que la
        // contrainte protège, et lui que la vente au guichet consulte.
        if ($trip !== null && $trip->seating_mode === SeatingMode::Capacity) {
            Trip::query()
                ->whereKey($trip->id)
                ->where('seats_taken', '>=', $passengers->count())
                ->decrement('seats_taken', $passengers->count());
        }

        // La réservation ne bascule que quand plus aucun passager ne voyage :
        // annuler une place sur trois laisse la réservation vivante, et les deux
        // autres billets valides.
        if ($booking->activePassengers()->count() === 0) {
            $booking->update([
                'status' => BookingStatus::CancelledByPassenger,
                'cancelled_at' => now(),
            ]);
        }
    }

    /**
     * @param  Collection<int, BookingPassenger>  $passengers
     */
    private function compensate(
        Booking $booking,
        Collection $passengers,
        CancellationTerms $terms,
        ?int $initiatedBy,
    ): ?Refund {
        /*
         * Vente au comptoir : **aucun remboursement par la plateforme**.
         *
         * L'argent n'y est jamais passé — l'agence a encaissé les espèces et
         * les rend elle-même. Émettre un remboursement reviendrait à lui faire
         * payer une seconde fois ce qu'elle rembourse déjà de la main à la main.
         */
        if ($booking->channel === BookingChannel::Counter) {
            $this->reverseCounterCommission($booking, $passengers->count());

            return null;
        }

        $payment = $booking->successfulPayment()->first();

        if ($payment === null || $terms->refundable <= 0) {
            return null;
        }

        // `record` seulement : l'envoi au prestataire se fait hors transaction,
        // par `execute` une fois celle-ci refermée.
        $refund = $this->refunds->record(
            payment: $payment,
            reason: RefundReason::PassengerRequest,
            description: "Annulation {$booking->reference}",
            amount: $terms->refundable,
            feeAmount: $terms->fee,
            seats: $passengers->count(),
            // Renseigné seulement si une seule place part : au-delà, le
            // remboursement couvre plusieurs passagers et n'en désigne aucun.
            passengerId: $passengers->count() === 1 ? $passengers->first()?->id : null,
            initiatedBy: $initiatedBy,
        );

        $this->settlement->handle($booking, $payment, $refund);

        return $refund;
    }

    /**
     * La commission guichet, si elle avait été débitée, n'a plus d'objet : elle
     * portait sur un transport qui n'aura pas lieu.
     */
    private function reverseCounterCommission(Booking $booking, int $seats): void
    {
        $commission = $booking->commission()->first();

        if ($commission === null || $booking->seats_count <= 0) {
            return;
        }

        $amount = intdiv($commission->amount * $seats, $booking->seats_count);

        if ($amount <= 0) {
            return;
        }

        AgencyLedgerEntry::query()->create([
            'agency_id' => $booking->agency_id,
            'booking_id' => $booking->id,
            'type' => 'COUNTER_COMMISSION_REVERSAL',
            'amount' => $amount,
            'currency' => $booking->currency,
            'reference_type' => 'commission',
            'reference_id' => $commission->id,
            'description' => "Commission guichet annulée sur {$booking->reference}",
            'occurred_at' => now(),
            'created_at' => now(),
        ]);
    }

    /**
     * Sans `passenger_ids`, la réservation entière part.
     *
     * Un identifiant qui n'appartient pas à la réservation, ou un passager déjà
     * annulé, est refusé plutôt qu'ignoré : annuler silencieusement moins de
     * places que demandé laisserait le passager croire qu'il sera remboursé de
     * ce qu'il ne sera pas.
     *
     * @param  list<int>  $passengerIds
     * @return Collection<int, BookingPassenger>
     */
    private function target(Booking $booking, array $passengerIds): Collection
    {
        $active = $booking->activePassengers()->get();

        if ($passengerIds === []) {
            if ($active->isEmpty()) {
                throw ApiException::of(
                    ErrorCode::BookingNotCancellable,
                    'Aucun passager actif sur cette réservation.',
                );
            }

            return $active;
        }

        $selected = $active->whereIn('id', $passengerIds);

        if ($selected->count() !== count(array_unique($passengerIds))) {
            throw ApiException::of(
                ErrorCode::ValidationFailed,
                'Passager inconnu sur cette réservation, ou déjà annulé.',
            );
        }

        return $selected;
    }
}
