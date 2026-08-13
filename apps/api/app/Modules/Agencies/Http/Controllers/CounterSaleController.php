<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Http\Controllers;

use App\Modules\Agencies\Support\AgencyContext;
use App\Modules\Bookings\Actions\CreateCounterSale;
use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Data\NewPassenger;
use App\Modules\Bookings\Http\Resources\BookingResource;
use App\Modules\Identity\Models\User;
use App\Modules\Tickets\Models\Ticket;
use App\Modules\Trips\Models\Trip;
use App\Modules\Trips\Support\SeatMap;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Vente au comptoir (I2).
 *
 * Un seul appel fait tout : places, réservation confirmée, paiement espèces,
 * billets, SMS. Le découper en plusieurs requêtes rendrait la saisie plus lente
 * que le cahier, et l'agence cesserait de l'utiliser — emportant avec elle la
 * fiabilité de la disponibilité affichée.
 */
final class CounterSaleController
{
    public function __construct(private readonly AgencyContext $context) {}

    public function store(Request $request, CreateCounterSale $sell): JsonResponse
    {
        $agency = $this->context->require($request);

        $validated = $request->validate([
            'trip_reference' => ['required', 'string', 'max:20'],
            'passengers' => ['required', 'array', 'min:1', 'max:20'],
            'passengers.*.first_name' => ['required', 'string', 'max:100'],
            'passengers.*.last_name' => ['required', 'string', 'max:100'],
            'passengers.*.seat_id' => ['nullable', 'integer'],
            // Nom et téléphone suffisent : aucune inscription, aucun OTP. C'est
            // une vente au comptoir, pas un tunnel de conversion.
            'contact_phone' => ['required', 'string', 'max:20'],
            'contact_name' => ['nullable', 'string', 'max:150'],
        ]);

        $result = $sell->handle($agency, new NewBooking(
            tripReference: (string) $validated['trip_reference'],
            passengers: $this->passengers($validated['passengers']),
            idempotencyKey: $this->idempotencyKey($request),
            userId: null,
            contactName: $validated['contact_name'] ?? null,
            contactPhone: (string) $validated['contact_phone'],
            // Qui a encaissé : une vente en espèces anonyme ne se réconcilie
            // pas avec la caisse en fin de journée.
            createdBy: $request->user() instanceof User ? $request->user()->id : null,
        ));

        $booking = $result['booking']->load([
            'trip.agency.commercialTerms', 'trip.originStation.city',
            'trip.destinationStation.city', 'trip.vehicle', 'trip.route.stops.city',
            'passengers.seat', 'passengers.ticket',
        ]);

        return response()->json([
            'booking' => (new BookingResource($booking))->resolve(),
            'amount_due' => ['amount' => $booking->total_amount, 'currency' => $booking->currency],
            'ticket_references' => $result['tickets']->map(fn (Ticket $t): string => $t->reference)->all(),
            'sms_sent' => $result['smsSent'],
        ], 201);
    }

    /**
     * Plan des places vu du guichet : le plan public, plus l'échéance des places
     * tenues.
     *
     * Le hold l'emporte sur le comptoir — donner la priorité au guichet
     * obligerait à rembourser un passager venant de payer avec succès. Mais
     * l'agent doit distinguer « vendue » de « tenue, se libère dans six
     * minutes » pour savoir s'il attend ou s'il oriente son client (B2).
     */
    public function seats(Request $request, string $reference): JsonResponse
    {
        $agency = $this->context->require($request);

        $trip = Trip::query()
            ->where('reference', $reference)
            ->withAvailability()
            ->with('vehicle')
            ->firstOrFail();

        $this->context->own($agency, $trip->agency_id);

        return response()->json(SeatMap::of($trip, withHoldDeadline: true));
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @return list<NewPassenger>
     */
    private function passengers(array $rows): array
    {
        $passengers = [];

        foreach ($rows as $row) {
            $seatId = $row['seat_id'] ?? null;

            $passengers[] = new NewPassenger(
                firstName: (string) ($row['first_name'] ?? ''),
                lastName: (string) ($row['last_name'] ?? ''),
                phone: null,
                seatId: is_numeric($seatId) ? (int) $seatId : null,
            );
        }

        return $passengers;
    }

    /**
     * Exigée comme sur la vente en ligne.
     *
     * La tablette d'un agent sur le wifi d'une gare n'est pas plus fiable qu'un
     * téléphone de passager : sans clé, une requête expirée puis rejouée
     * produirait une seconde vente et un second encaissement à réconcilier.
     */
    private function idempotencyKey(Request $request): string
    {
        $key = $request->header('Idempotency-Key');

        if (!is_string($key) || trim($key) === '') {
            throw ApiException::of(
                ErrorCode::ValidationFailed,
                'En-tête Idempotency-Key requise sur la vente au guichet.',
            );
        }

        return trim($key);
    }
}
