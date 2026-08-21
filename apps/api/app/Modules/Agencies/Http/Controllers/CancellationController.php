<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Http\Controllers;

use App\Modules\Agencies\Support\AgencyContext;
use App\Modules\Bookings\Actions\CancelBooking;
use App\Modules\Bookings\Http\Controllers\BookingController;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Identity\Models\User;
use App\Modules\Trips\Actions\CancelTrip;
use App\Modules\Trips\Http\Resources\TripSummaryResource;
use App\Modules\Trips\Models\Trip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Annulations à l'initiative de l'agence (B5).
 */
final class CancellationController
{
    public function __construct(private readonly AgencyContext $context) {}

    /**
     * Annuler un départ entier.
     *
     * Le cas le plus fréquent sur le terrain — panne, effectif insuffisant,
     * route coupée — et le plus lourd : plusieurs dizaines de passagers déjà
     * payés, souvent prévenus la veille au soir ou le matin même.
     */
    public function trip(Request $request, string $reference, CancelTrip $cancel): JsonResponse
    {
        $agency = $this->context->requireApproved($request);

        $validated = $request->validate([
            // Obligatoire : sans motif, le suivi du taux d'annulation ne
            // distingue pas une panne isolée d'une agence qui surréserve.
            'reason' => ['required', 'string', 'in:BREAKDOWN,INSUFFICIENT_PASSENGERS,ROAD_CLOSED,OTHER'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $trip = Trip::query()->where('reference', $reference)->firstOrFail();
        $this->context->own($agency, $trip->agency_id);

        $result = $cancel->handle(
            $trip,
            (string) $validated['reason'],
            $validated['note'] ?? null,
            $this->actor($request),
        );

        $summary = (new TripSummaryResource($result['trip']->load(
            'agency.commercialTerms', 'originStation.city', 'destinationStation.city', 'route.stops.city',
        )))->resolve();

        return response()->json([
            'trip' => $summary,
            'bookings_cancelled' => $result['bookings'],
            'passengers_cancelled' => $result['passengers'],
            'refunded' => ['amount' => $result['refunded'], 'currency' => $result['trip']->currency],
        ]);
    }

    /**
     * Annuler une réservation vendue par l'agence.
     *
     * Ce n'est pas du confort : un passager de vente au comptoir n'a pas de
     * compte et ne peut rien annuler lui-même. Sans cette route, son siège
     * resterait bloqué jusqu'au départ, indisponible pour tout le monde (I2).
     */
    public function booking(Request $request, string $reference, CancelBooking $cancel): JsonResponse
    {
        $agency = $this->context->requireApproved($request);

        $booking = Booking::query()->where('reference', $reference)->firstOrFail();
        $this->context->own($agency, $booking->agency_id);

        $validated = $request->validate([
            'passenger_ids' => ['array'],
            'passenger_ids.*' => ['integer'],
        ]);

        $result = $cancel->handle(
            $booking,
            array_values(array_map(intval(...), (array) ($validated['passenger_ids'] ?? []))),
            $this->actor($request),
        );

        return response()->json(BookingController::cancellation($result));
    }

    private function actor(Request $request): ?int
    {
        $user = $request->user();

        return $user instanceof User ? $user->id : null;
    }
}
