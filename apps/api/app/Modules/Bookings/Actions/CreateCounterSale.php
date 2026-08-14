<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Actions;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Enums\BookingChannel;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Identity\Enums\Locale;
use App\Modules\Notifications\Contracts\SmsSender;
use App\Modules\Notifications\Data\SmsMessage;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Commission;
use App\Modules\Tickets\Actions\IssueTickets;
use App\Modules\Tickets\Models\Ticket;
use App\Modules\Trips\Models\Trip;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use App\Support\Reference;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Vente au comptoir (I2).
 *
 * **Ce chantier porte l'intégrité de toute la disponibilité affichée.** Si une
 * agence vend vingt places au comptoir sans les saisir, MOTOBOY montre des
 * places qui n'existent pas et le passager se déplace pour rien. La seule chose
 * qui garantit la saisie, c'est qu'elle soit plus rapide que le cahier.
 *
 * D'où un unique appel qui fait tout : places, réservation confirmée, paiement
 * espèces, billets, SMS.
 */
final class CreateCounterSale
{
    public function __construct(
        private readonly CreateBooking $bookings,
        private readonly IssueTickets $tickets,
        private readonly SmsSender $sms,
    ) {}

    /** @return array{booking: Booking, tickets: Collection<int, Ticket>, smsSent: bool} */
    public function handle(Agency $agency, NewBooking $request): array
    {
        $replay = $this->findReplay($agency, $request);

        if ($replay !== null) {
            return $replay;
        }

        $trip = $this->findSellableTrip($agency, $request->tripReference);

        $booking = $this->sell($trip, $request);
        $tickets = $this->tickets->handle($booking->refresh());

        return [
            'booking' => $booking->refresh(),
            'tickets' => $tickets,
            'smsSent' => $this->notify($agency, $booking, $tickets),
        ];
    }

    /**
     * Rejeu : la même clé renvoie la vente initiale sans en créer une seconde.
     *
     * La tablette d'un agent sur le wifi d'une gare n'est pas plus fiable que le
     * téléphone d'un passager. Sans cette reprise, la requête rejouée butait sur
     * l'index d'unicité et remontait une erreur serveur — laissant l'agent
     * incapable de dire si l'argent qu'il tient correspond à une vente
     * enregistrée ou non.
     *
     * @return array{booking: Booking, tickets: Collection<int, Ticket>, smsSent: bool}|null
     */
    private function findReplay(Agency $agency, NewBooking $request): ?array
    {
        $booking = Booking::query()
            ->where('idempotency_key', $request->idempotencyKey)
            ->first();

        if ($booking === null) {
            return null;
        }

        // Une clé appartenant à une autre agence — ou à une vente en ligne —
        // n'ouvre pas la réservation correspondante.
        if ($booking->agency_id !== $agency->id || $booking->channel !== BookingChannel::Counter) {
            throw ApiException::of(ErrorCode::ValidationFailed, 'Clé d\'idempotence déjà utilisée.');
        }

        return [
            'booking' => $booking,
            'tickets' => Ticket::query()->where('booking_id', $booking->id)->get(),
            // Aucun second SMS : il est déjà parti, et le repayer sur une vente
            // ne portant aucune commission serait une fuite pure. On rapporte
            // l'état du premier envoi, pas un nouveau.
            'smsSent' => Notification::query()
                ->where('type', 'COUNTER_TICKET')
                ->where('status', 'SENT')
                ->where('payload->booking_reference', $booking->reference)
                ->exists(),
        ];
    }

    private function sell(Trip $trip, NewBooking $request): Booking
    {
        try {
            return DB::transaction(function () use ($trip, $request): Booking {
                // La prise de places reste celle de B2 : mêmes verrous, même
                // index unique. Vendre au comptoir ne dispense pas des
                // garde-fous — c'est même là que la double-vente coûterait le
                // plus, le passager étant devant l'agent.
                $booking = $this->bookings->takeSeatsForCounterSale($trip, $request);

                $this->recordCashPayment($booking);
                $this->recordCommissionIfDue($booking);

                return $booking;
            });
        } catch (QueryException $e) {
            if (str_contains($e->getMessage(), 'booking_passengers_seat_unique')) {
                throw ApiException::of(
                    ErrorCode::SeatAlreadyHeld,
                    'Un des sièges demandés vient d\'être pris.',
                    ['seat_ids' => $request->seatIds()],
                );
            }

            throw $e;
        }
    }

    /**
     * Le paiement est enregistré bien qu'il ne transite jamais par
     * l'agrégateur : sans lui, la vente guichet disparaîtrait des statistiques
     * et le chiffre d'affaires réel de l'agence serait faux.
     */
    private function recordCashPayment(Booking $booking): void
    {
        Payment::query()->create([
            'reference' => Reference::generate('PAY'),
            'booking_id' => $booking->id,
            'amount' => $booking->total_amount,
            'currency' => $booking->currency,
            'method' => PaymentMethod::Cash,
            'idempotency_key' => 'cash-'.$booking->reference,
            'status' => PaymentStatus::Succeeded,
            'paid_at' => now(),
        ]);
    }

    /**
     * Le flux d'argent d'une vente guichet est l'inverse de celui d'une vente
     * en ligne, et c'est le point le plus facile à se tromper.
     *
     * **Aucun crédit au compte courant** : l'agence a encaissé les espèces
     * elle-même, l'argent n'est jamais passé par la plateforme. Créditer puis
     * reverser reviendrait à lui payer une seconde fois ce qu'elle a déjà.
     *
     * Si la commission est activée — désactivée par défaut (B4) — c'est
     * l'agence qui **doit** cette commission à MOTOBOY : d'où un débit seul,
     * qui viendra en déduction de son prochain reversement.
     */
    private function recordCommissionIfDue(Booking $booking): void
    {
        $terms = $booking->agency?->commercialTerms;

        if ($terms === null || !$terms->counter_sale_commission_enabled) {
            return;
        }

        $amount = $booking->commission_type === 'FIXED'
            ? min($booking->commission_value, $booking->total_amount)
            : intdiv($booking->total_amount * $booking->commission_value, 10_000);

        if ($amount <= 0) {
            return;
        }

        $commission = Commission::query()->create([
            'booking_id' => $booking->id,
            'agency_id' => $booking->agency_id,
            'base_amount' => $booking->total_amount,
            'type' => $booking->commission_type,
            'value' => $booking->commission_value,
            'amount' => $amount,
            'aggregator_fee_amount' => 0,
            'status' => 'ACCRUED',
        ]);

        AgencyLedgerEntry::query()->create([
            'agency_id' => $booking->agency_id,
            'booking_id' => $booking->id,
            'type' => 'COUNTER_COMMISSION_DEBIT',
            'amount' => -$amount,
            'currency' => $booking->currency,
            'reference_type' => 'commission',
            'reference_id' => $commission->id,
            'description' => "Commission guichet sur {$booking->reference}",
            'occurred_at' => now(),
            'created_at' => now(),
        ]);
    }

    /**
     * Le billet part par SMS **et** s'imprime au comptoir.
     *
     * C'est le seul cas où la plateforme paie un SMS sur une vente ne portant
     * aucune commission : à volume élevé la fuite devient nette, d'où
     * l'interrupteur par agence — le levier doit exister avant d'en avoir
     * besoin (I2).
     *
     * @param  Collection<int, Ticket>  $tickets
     */
    private function notify(Agency $agency, Booking $booking, Collection $tickets): bool
    {
        $terms = $agency->commercialTerms;

        if ($terms !== null && !$terms->counter_sale_sms_enabled) {
            return false;
        }

        $phone = $booking->contact_phone;

        if ($phone === null || trim($phone) === '') {
            return false;
        }

        // Langue par défaut de l'agence : le passager n'a pas de compte, donc
        // pas de `users.locale` (I10).
        $locale = $agency->default_locale ?? Locale::French;

        $body = trans('sms.counter_ticket', [
            'reference' => $booking->reference,
            'count' => $tickets->count(),
        ], $locale->value);

        $result = $this->sms->send(new SmsMessage(
            to: $phone,
            body: is_string($body) ? $body : '',
            locale: $locale,
            type: 'COUNTER_TICKET',
        ));

        Notification::query()->create([
            'phone' => $phone,
            'channel' => 'SMS',
            'locale' => $locale,
            'type' => 'COUNTER_TICKET',
            'payload' => ['booking_reference' => $booking->reference],
            'status' => $result->delivered ? 'SENT' : 'FAILED',
            'provider_reference' => $result->providerReference,
            'sent_at' => $result->delivered ? now() : null,
            'error' => $result->error,
        ]);

        return $result->delivered;
    }

    /**
     * La vente au guichet reste ouverte **jusqu'au départ**, alors que la vente
     * en ligne ferme trente minutes avant : l'agence voit le véhicule et
     * maîtrise sa situation (B2).
     */
    private function findSellableTrip(Agency $agency, string $reference): Trip
    {
        $trip = Trip::query()
            ->where('reference', $reference)
            ->with('agency.commercialTerms', 'vehicle')
            ->first();

        if ($trip === null || $trip->agency_id !== $agency->id) {
            throw ApiException::of(ErrorCode::NotFound, 'Départ introuvable.');
        }

        if ($trip->status === 'CANCELLED') {
            throw ApiException::of(ErrorCode::TripCancelled, 'Ce départ a été annulé.');
        }

        if ($trip->departure_at !== null && $trip->departure_at->isPast()) {
            throw ApiException::of(
                ErrorCode::OnlineSalesClosed,
                'Ce départ est déjà parti.',
                ['departed_at' => $trip->departure_at->toIso8601String()],
            );
        }

        return $trip;
    }
}
