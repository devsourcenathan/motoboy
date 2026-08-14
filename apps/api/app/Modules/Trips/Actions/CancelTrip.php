<?php

declare(strict_types=1);

namespace App\Modules\Trips\Actions;

use App\Modules\Bookings\Enums\BookingChannel;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Notifications\Jobs\NotifyTripCancelled;
use App\Modules\Payments\Actions\RefundPayment;
use App\Modules\Payments\Enums\RefundReason;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payouts\Actions\RecordCancellationSettlement;
use App\Modules\Tickets\Enums\TicketStatus;
use App\Modules\Trips\Models\Trip;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Support\Facades\DB;

/**
 * Annulation d'un départ par l'agence (B5).
 *
 * Le cas le plus fréquent sur le terrain — panne, effectif insuffisant, route
 * coupée — et le plus lourd : plusieurs dizaines de passagers déjà payés.
 *
 * **Remboursement intégral automatique, sans frais, sans validation manuelle.**
 * L'agence a décidé d'annuler ; faire attendre une approbation laisserait des
 * passagers payer pour un car qui ne partira pas.
 *
 * **Rembourser d'abord, proposer ensuite.** Le transfert vers un autre départ
 * n'est pas au MVP : il impliquerait de gérer les différences de prix, la
 * disponibilité, la resélection de sièges et les groupes transférables seulement
 * en partie. Le passager est remboursé et reçoit des alternatives dans sa
 * notification ; s'il le souhaite, il réserve normalement.
 */
final class CancelTrip
{
    public function __construct(
        private readonly RefundPayment $refunds,
        private readonly RecordCancellationSettlement $settlement,
    ) {}

    /** @return array{trip: Trip, bookings: int, passengers: int, refunded: int} */
    public function handle(Trip $trip, string $reason, ?string $note = null, ?int $cancelledBy = null): array
    {
        if ($trip->status === 'CANCELLED') {
            throw ApiException::of(ErrorCode::TripCancelled, 'Ce départ est déjà annulé.');
        }

        $bookings = Booking::query()
            ->where('trip_id', $trip->id)
            ->whereIn('status', [BookingStatus::Confirmed->value, BookingStatus::PendingPayment->value])
            ->with('successfulPayment')
            ->get();

        $confirmed = $bookings->where('status', BookingStatus::Confirmed);

        DB::transaction(function () use ($trip, $reason, $note, $cancelledBy, $confirmed): void {
            $trip->update([
                'status' => 'CANCELLED',
                'cancelled_at' => now(),
                'cancelled_by' => $cancelledBy,
                'cancellation_reason' => $reason,
                /*
                 * Figé maintenant : les réservations passent ensuite en
                 * `CANCELLED_BY_AGENCY` et l'information serait perdue. Le taux
                 * d'annulation d'une agence ne compte que les départs portant
                 * des réservations confirmées — supprimer un départ généré non
                 * assuré relève de la gestion de planning, pas de l'incident.
                 */
                'had_confirmed_bookings_at_cancellation' => $confirmed->isNotEmpty(),

                // Texte libre de l'agent — « pont coupé à Melong ». Le passager
                // le lit dans sa notification ; sans lui il reçoit « panne » et
                // rappelle l'agence.
                'cancellation_note' => $note,

                // Le compteur du mode capacité repart de zéro : plus personne ne
                // voyage sur ce départ.
                'seats_taken' => 0,
            ]);
        });

        $passengers = 0;
        $refunded = 0;

        foreach ($bookings as $booking) {
            // Une transaction par réservation : trente passagers ne doivent pas
            // dépendre d'un verrou unique, et l'échec d'un remboursement ne doit
            // pas annuler l'annulation des autres.
            $passengers += $this->cancel($booking, $cancelledBy);

            $refund = $this->refundInFull($booking, $cancelledBy);
            $refunded += $refund === null ? 0 : $refund->amount;
        }

        // Notification immédiate sur tous les canaux, SMS compris : c'est
        // précisément le cas où le coût du SMS est justifié — un passager qui se
        // déplace vers une gare pour un car annulé est perdu définitivement.
        //
        // En file : notifier trente passagers en synchrone ferait expirer la
        // requête au pire moment possible.
        NotifyTripCancelled::dispatch($trip->id);

        return [
            'trip' => $trip->refresh(),
            'bookings' => $bookings->count(),
            'passengers' => $passengers,
            'refunded' => $refunded,
        ];
    }

    /** @return int Passagers libérés. */
    private function cancel(Booking $booking, ?int $cancelledBy): int
    {
        return DB::transaction(function () use ($booking, $cancelledBy): int {
            $released = $booking->activePassengers()->count();

            $booking->passengers()
                ->where('status', 'ACTIVE')
                ->update(['status' => 'CANCELLED', 'holds_seat' => false]);

            $booking->tickets()->update(['status' => TicketStatus::Cancelled]);

            $booking->update([
                'status' => BookingStatus::CancelledByAgency,
                'cancelled_at' => now(),
                'cancelled_by' => $cancelledBy,
                'cancellation_reason' => 'TRIP_CANCELLED',
            ]);

            return $released;
        });
    }

    /**
     * Remboursement **intégral et sans frais** : le passager n'y est pour rien.
     *
     * Une vente au comptoir n'en produit aucun — l'argent n'est jamais passé par
     * la plateforme, et c'est l'agence qui rend les espèces.
     */
    private function refundInFull(Booking $booking, ?int $cancelledBy): ?Refund
    {
        if ($booking->channel === BookingChannel::Counter) {
            return null;
        }

        $payment = $booking->successfulPayment;

        if ($payment === null) {
            return null;
        }

        $refund = $this->refunds->handle(
            payment: $payment,
            reason: RefundReason::AgencyTripCancelled,
            description: "Départ annulé — {$booking->reference}",
            amount: $payment->amount,
            feeAmount: 0,
            seats: $booking->seats_count,
            initiatedBy: $cancelledBy,
        );

        $this->settlement->handle($booking, $payment, $refund);

        return $refund;
    }
}
