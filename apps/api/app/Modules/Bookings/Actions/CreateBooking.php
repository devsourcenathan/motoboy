<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Actions;

use App\Modules\Agencies\Models\AgencyCommercialTerms;
use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Fleet\Models\VehicleSeat;
use App\Modules\Trips\Models\Trip;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use App\Support\Reference;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Prise de places et création de la réservation.
 *
 * C'est **l'opération atomique** du produit : toute la mécanique de B2 s'y joue.
 * Les places sont tenues dès cet appel, avant même la saisie du paiement —
 * tenir la place seulement au moment de payer laisserait deux passagers saisir
 * en parallèle, l'un des deux perdant sa place au dernier écran.
 *
 * **Une réservation de plusieurs places est prise en tout ou rien.**
 */
final class CreateBooking
{
    public function handle(NewBooking $request): Booking
    {
        // Rejeu : la même clé renvoie la réservation initiale sans en créer une
        // seconde. Sur une connexion mobile instable, une requête qui expire
        // côté client mais aboutit côté serveur n'est pas un cas rare — sans
        // cela, le passager immobilise deux places et paie deux fois.
        $existing = $this->findReplay($request);

        if ($existing !== null) {
            return $existing;
        }

        $trip = $this->findBookableTrip($request->tripReference);
        $terms = $this->termsOf($trip);

        $this->guardSeatSelection($trip, $request);

        try {
            return DB::transaction(fn (): Booking => $this->take($trip, $terms, $request));
        } catch (UniqueConstraintViolationException $e) {
            // La violation d'unicité est un **cas nominal**, pas une panne :
            // deux passagers ont visé le même siège, l'index a arbitré.
            throw $this->translate($e, $request);
        } catch (QueryException $e) {
            throw $this->translate($e, $request);
        }
    }

    /**
     * Toute la prise de places, dans une seule transaction.
     *
     * L'Action détient la transaction — ni le contrôleur ni le modèle (§4 du
     * standard de code).
     */
    private function take(Trip $trip, AgencyCommercialTerms $terms, NewBooking $request): Booking
    {
        $seats = $request->seatCount();

        if ($trip->seating_mode === SeatingMode::Capacity) {
            $this->reserveCapacity($trip, $seats);
        }

        $booking = Booking::query()->create([
            'reference' => Reference::generate('MTB'),
            'idempotency_key' => $request->idempotencyKey,
            'trip_id' => $trip->id,
            'agency_id' => $trip->agency_id,
            'user_id' => $request->userId,
            'channel' => 'ONLINE',
            'status' => BookingStatus::PendingPayment,
            'expires_at' => now()->addMinutes($terms->hold_duration_minutes),
            'seats_count' => $seats,
            'total_amount' => $trip->price * $seats,
            'currency' => $trip->currency,
            'contact_name' => $request->contactName,
            'contact_phone' => $request->contactPhone,

            /*
             * Conditions figées à la création (B4 et B5).
             *
             * Aucun calcul financier ne doit lire les conditions courantes de
             * l'agence : sans ce figement, modifier un taux de commission
             * réécrirait rétroactivement l'historique de toutes les
             * réservations passées, y compris celles déjà reversées et déjà
             * justifiées à l'agence par un relevé.
             */
            'commission_type' => $terms->commission_type,
            'commission_value' => $terms->commission_value,
            'fee_bearer' => $terms->fee_bearer,
            'cancellation_deadline_hours' => $terms->cancellation_deadline_hours,
            'cancellation_fee_type' => $terms->cancellation_fee_type,
            'cancellation_fee_value' => $terms->cancellation_fee_value,
        ]);

        foreach ($request->passengers as $passenger) {
            $booking->passengers()->create([
                'trip_id' => $trip->id,
                'seat_id' => $passenger->seatId,
                // C'est ce drapeau que lit l'index unique partiel : le poser
                // *est* la prise de place.
                'holds_seat' => true,
                'first_name' => $passenger->firstName,
                'last_name' => $passenger->lastName,
                'phone' => $passenger->phone,
                'status' => 'ACTIVE',
            ]);
        }

        return $booking;
    }

    /**
     * Mode capacité : verrou de ligne sur le départ, puis incrément.
     *
     * Le verrou sérialise les réservations concurrentes du même départ, et la
     * contrainte `seats_taken <= capacity` rattrape une erreur applicative.
     * Compter des lignes ne peut pas être contraint — c'est toute la raison
     * d'être du compteur.
     */
    private function reserveCapacity(Trip $trip, int $seats): void
    {
        /** @var Trip $locked */
        $locked = Trip::query()->whereKey($trip->id)->lockForUpdate()->firstOrFail();

        if ($locked->seats_taken + $seats > $locked->capacity) {
            throw ApiException::of(
                ErrorCode::TripFull,
                'Places insuffisantes sur ce départ.',
                ['seats_available' => max(0, $locked->capacity - $locked->seats_taken)],
            );
        }

        $locked->increment('seats_taken', $seats);
    }

    private function findReplay(NewBooking $request): ?Booking
    {
        $booking = Booking::query()
            ->where('idempotency_key', $request->idempotencyKey)
            ->first();

        if ($booking === null) {
            return null;
        }

        // Une clé appartenant à quelqu'un d'autre n'ouvre pas sa réservation :
        // un UUID ne se devine pas, mais rien n'oblige un client à en fournir un.
        if ($booking->user_id !== $request->userId) {
            throw ApiException::of(
                ErrorCode::ValidationFailed,
                'Clé d\'idempotence déjà utilisée.',
            );
        }

        return $booking;
    }

    private function findBookableTrip(string $reference): Trip
    {
        $trip = Trip::query()
            ->where('reference', $reference)
            ->with('agency.commercialTerms', 'vehicle')
            ->first();

        if ($trip === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Départ introuvable.');
        }

        if ($trip->status === 'CANCELLED') {
            throw ApiException::of(ErrorCode::TripCancelled, 'Ce départ a été annulé.');
        }

        // Sans cette borne, une réservation resterait possible quelques secondes
        // avant le départ : le passager ne peut matériellement pas s'y
        // présenter, et la liste d'embarquement est déjà établie (B2).
        if ($trip->online_sales_close_at !== null && $trip->online_sales_close_at->isPast()) {
            throw ApiException::of(
                ErrorCode::OnlineSalesClosed,
                'Les réservations en ligne sont closes pour ce départ.',
                ['closed_at' => $trip->online_sales_close_at->toIso8601String()],
            );
        }

        return $trip;
    }

    /**
     * Une agence approuvée sans conditions commerciales est une incohérence de
     * données, pas un cas métier : réserver produirait une commission fausse et
     * un reversement erroné. On refuse bruyamment plutôt que de deviner.
     */
    private function termsOf(Trip $trip): AgencyCommercialTerms
    {
        $terms = $trip->agency?->commercialTerms;

        if ($terms === null) {
            throw new \RuntimeException(
                "Agence {$trip->agency_id} sans conditions commerciales : réservation impossible.",
            );
        }

        return $terms;
    }

    /**
     * Vérifie que les sièges demandés existent sur le véhicule du départ et
     * sont vendables.
     *
     * Sans ce contrôle, un identifiant de siège pris sur un autre véhicule
     * passerait l'index unique — il ne serait en conflit avec rien — et
     * produirait un billet portant une place qui n'existe pas dans le car.
     */
    private function guardSeatSelection(Trip $trip, NewBooking $request): void
    {
        $seatIds = $request->seatIds();

        if ($trip->seating_mode === SeatingMode::Capacity) {
            if ($seatIds !== []) {
                throw ApiException::of(
                    ErrorCode::ValidationFailed,
                    'Ce véhicule ne gère pas les sièges individuellement.',
                );
            }

            return;
        }

        if (count($seatIds) !== $request->seatCount()) {
            throw ApiException::of(ErrorCode::ValidationFailed, 'Un siège doit être choisi par passager.');
        }

        if (count(array_unique($seatIds)) !== count($seatIds)) {
            throw ApiException::of(ErrorCode::ValidationFailed, 'Deux passagers ne peuvent pas partager un siège.');
        }

        $valid = VehicleSeat::query()
            ->where('vehicle_id', $trip->vehicle_id)
            ->whereIn('id', $seatIds)
            ->where('is_bookable', true)
            ->count();

        if ($valid !== count($seatIds)) {
            throw ApiException::of(
                ErrorCode::ValidationFailed,
                'Siège inconnu sur ce véhicule, ou non vendable.',
            );
        }
    }

    /**
     * Traduit une violation de contrainte en cas métier.
     *
     * La capture est **hors** de la transaction : PostgreSQL avorte la
     * transaction dès la première erreur, et toute requête ultérieure y échoue.
     * Tenter de traduire depuis l'intérieur produirait une seconde erreur, plus
     * obscure que la première.
     */
    private function translate(QueryException $e, NewBooking $request): ApiException
    {
        $message = $e->getMessage();

        if (str_contains($message, 'booking_passengers_seat_unique')) {
            return ApiException::of(
                ErrorCode::SeatAlreadyHeld,
                'Un des sièges demandés vient d\'être pris.',
                ['seat_ids' => $request->seatIds()],
            );
        }

        if (str_contains($message, 'trips_seats_taken_within_capacity')) {
            return ApiException::of(ErrorCode::TripFull, 'Places insuffisantes sur ce départ.');
        }

        if (str_contains($message, 'bookings_idempotency_key_unique')) {
            return ApiException::of(ErrorCode::ValidationFailed, 'Clé d\'idempotence déjà utilisée.');
        }

        throw $e;
    }
}
