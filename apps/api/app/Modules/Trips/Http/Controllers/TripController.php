<?php

declare(strict_types=1);

namespace App\Modules\Trips\Http\Controllers;

use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Trips\Http\Resources\TripSummaryResource;
use App\Modules\Trips\Models\Trip;
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
     * En mode `CAPACITY`, `seats` est vide et seuls les compteurs sont
     * renseignés : il n'y a pas de plan à afficher, et prétendre le contraire
     * obligerait à inventer des sièges qui n'existent pas.
     */
    public function seats(string $reference): JsonResponse
    {
        $trip = $this->find($reference);

        $held = $trip->getAttribute('held_seats_count');
        $available = is_numeric($held) ? $trip->capacity - (int) $held : $trip->capacity;

        return response()->json([
            'seating_mode' => $trip->seating_mode,
            'capacity' => $trip->capacity,
            'seats_available' => $available,
            'seats' => $trip->seating_mode === SeatingMode::Seated ? $this->seatMap($trip) : [],
        ]);
    }

    /**
     * Une place **tenue** par un paiement en cours est indisponible au même
     * titre qu'une place vendue, sur tous les canaux — vente au guichet
     * comprise (B2). Les deux se distinguent néanmoins à l'affichage, pour que
     * l'agent au comptoir sache s'il peut attendre.
     *
     * @return list<array<string, mixed>>
     */
    private function seatMap(Trip $trip): array
    {
        $vehicle = $trip->vehicle;

        if ($vehicle === null) {
            return [];
        }

        /** @var array<int, string> $occupancy */
        $occupancy = $trip->passengers()
            ->where('holds_seat', true)
            ->whereNotNull('seat_id')
            ->with('booking')
            ->get()
            ->mapWithKeys(fn ($passenger): array => [
                (int) $passenger->seat_id => $passenger->booking?->status->holdsSeat() === true
                    && $passenger->booking->status->value === 'PENDING_PAYMENT'
                        ? 'HELD'
                        : 'TAKEN',
            ])
            ->all();

        $seats = [];

        foreach ($vehicle->seats()->orderBy('row_index')->orderBy('column_index')->get() as $seat) {
            $seats[] = [
                'id' => $seat->id,
                'label' => $seat->label,
                'row_index' => $seat->row_index,
                'column_index' => $seat->column_index,
                'status' => match (true) {
                    !$seat->is_bookable => 'UNAVAILABLE',
                    isset($occupancy[$seat->id]) => $occupancy[$seat->id],
                    default => 'AVAILABLE',
                },
            ];
        }

        return $seats;
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
