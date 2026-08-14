<?php

declare(strict_types=1);

namespace App\Modules\Trips\Http\Controllers;

use App\Modules\Trips\Http\Resources\TripSummaryResource;
use App\Modules\Trips\Models\Trip;
use App\Modules\Trips\Support\SeatMap;
use Illuminate\Http\JsonResponse;

final class TripController
{
    public function show(string $reference): JsonResponse
    {
        $trip = $this->find($reference);

        /** @var array<string, mixed> $summary */
        $summary = (new TripSummaryResource($trip))->resolve();

        return response()->json([
            ...$summary,
            'vehicle' => [
                'brand' => $trip->vehicle?->brand,
                'model' => $trip->vehicle?->model,
                'type' => $trip->vehicle?->type,
            ],
        ]);
    }

    /**
     * Plan des places et disponibilité.
     *
     * Le passager ne voit pas l'échéance des places tenues : elle ne lui sert à
     * rien — il ne peut pas décider d'attendre à la place de quelqu'un — et
     * exposerait le rythme des ventes d'une agence à ses concurrents.
     */
    public function seats(string $reference): JsonResponse
    {
        return response()->json(SeatMap::of($this->find($reference)));
    }

    private function find(string $reference): Trip
    {
        return Trip::query()
            ->where('reference', $reference)
            ->withAvailability()
            ->with([
                'agency.commercialTerms',
                'originStation.city',
                'destinationStation.city',
                'vehicle',
                'route.stops.city',
            ])
            ->firstOrFail();
    }
}
