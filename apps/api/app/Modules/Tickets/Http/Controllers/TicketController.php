<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Http\Controllers;

use App\Modules\Tickets\Http\Resources\TicketResource;
use App\Modules\Tickets\Models\Ticket;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class TicketController
{
    /** @var list<string> */
    private const RELATIONS = [
        'booking',
        'passenger.seat',
        'trip.agency.commercialTerms',
        'trip.originStation.city',
        'trip.destinationStation.city',
        'trip.vehicle',
        'trip.route.stops.city',
    ];

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 100);

        $tickets = Ticket::query()
            ->whereHas('booking', fn ($q) => $q->where('user_id', $request->user()?->getAuthIdentifier()))
            ->with(self::RELATIONS)
            ->join('trips', 'trips.id', '=', 'tickets.trip_id')
            ->orderByDesc('trips.departure_at')
            ->select('tickets.*')
            ->paginate($perPage);

        return response()->json([
            'data' => TicketResource::collection($tickets->items())->resolve(),
            'meta' => [
                'page' => $tickets->currentPage(),
                'per_page' => $tickets->perPage(),
                'total' => $tickets->total(),
                'last_page' => $tickets->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, string $reference): JsonResponse
    {
        $ticket = Ticket::query()
            ->where('reference', $reference)
            ->with(self::RELATIONS)
            ->firstOrFail();

        // La référence figure sur le billet et se dicte au téléphone : elle
        // identifie, elle n'authentifie pas.
        if ($ticket->booking?->user_id !== $request->user()?->getAuthIdentifier()) {
            throw ApiException::of(ErrorCode::Forbidden, 'Ce billet ne vous appartient pas.');
        }

        return response()->json((new TicketResource($ticket))->resolve());
    }
}
