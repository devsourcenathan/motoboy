<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Controllers;

use App\Modules\Bookings\Actions\CreateBooking;
use App\Modules\Bookings\Http\Requests\CreateBookingRequest;
use App\Modules\Bookings\Http\Resources\BookingResource;
use App\Modules\Bookings\Models\Booking;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Contrôleur fin : il valide, appelle une Action, renvoie une ressource. Aucune
 * règle métier, aucune transaction (§4 du standard de code).
 */
final class BookingController
{
    /** @var list<string> */
    private const RELATIONS = [
        'trip.agency.commercialTerms',
        'trip.originStation.city',
        'trip.destinationStation.city',
        'trip.vehicle',
        'trip.route.stops.city',
        'passengers.seat',
        'passengers.ticket',
    ];

    public function store(CreateBookingRequest $request, CreateBooking $create): JsonResponse
    {
        $booking = $create->handle($request->newBooking());
        $booking->load(self::RELATIONS);

        return response()->json((new BookingResource($booking))->resolve(), 201);
    }

    public function show(Request $request, string $reference): JsonResponse
    {
        $booking = Booking::query()
            ->where('reference', $reference)
            ->with(self::RELATIONS)
            ->firstOrFail();

        // La référence circule — sur un billet, un SMS, une capture d'écran.
        // Elle identifie, elle n'authentifie pas.
        if ($booking->user_id !== $request->user()?->getAuthIdentifier()) {
            throw ApiException::of(ErrorCode::Forbidden, 'Cette réservation ne vous appartient pas.');
        }

        return response()->json((new BookingResource($booking))->resolve());
    }
}
