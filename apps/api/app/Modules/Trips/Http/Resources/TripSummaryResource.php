<?php

declare(strict_types=1);

namespace App\Modules\Trips\Http\Resources;

use App\Modules\Trips\Models\Trip;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Conforme au schéma `TripSummary` de `docs/openapi.yaml`, qui est normatif.
 *
 * @mixin Trip
 */
final class TripSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $trip = $this->resource;

        return [
            'reference' => $trip->reference,
            'agency' => [
                'id' => $trip->agency?->id,
                'name' => $trip->agency?->name,
                'logo_url' => $trip->agency?->logo_path,
            ],
            'departure_at' => $trip->departure_at?->toIso8601String(),
            'arrival_estimate_at' => $trip->arrival_estimate_at?->toIso8601String(),
            'duration_minutes' => $trip->route?->reference_duration_minutes,
            'origin_station' => self::station($trip, 'originStation'),
            'destination_station' => self::station($trip, 'destinationStation'),
            'price' => ['amount' => $trip->price, 'currency' => $trip->currency],
            'seats_available' => self::seatsAvailable($trip),
            'capacity' => $trip->capacity,
            'seating_mode' => $trip->seating_mode,
            'vehicle_type' => $trip->vehicle?->type,
            'stops' => self::stops($trip),
            'cancellation_policy' => self::cancellationPolicy($trip),
            'online_sales_close_at' => $trip->online_sales_close_at?->toIso8601String(),
        ];
    }

    /**
     * `held_seats_count` vient de `scopeWithAvailability`. Un départ chargé sans
     * cette portée n'a pas de disponibilité calculable : on renvoie `null`
     * plutôt qu'un chiffre faux — `Model::shouldBeStrict` fait d'ailleurs échouer
     * l'accès en développement.
     */
    private static function seatsAvailable(Trip $trip): ?int
    {
        $held = $trip->getAttribute('held_seats_count');

        return is_numeric($held) ? $trip->capacity - (int) $held : null;
    }

    /** @return array<string, mixed>|null */
    private static function station(Trip $trip, string $relation): ?array
    {
        $station = $trip->getRelationValue($relation);

        if ($station === null) {
            return null;
        }

        return [
            'id' => $station->id,
            'name' => $station->name,
            'city' => $station->city?->name,
            'address' => $station->address,
            'latitude' => $station->latitude === null ? null : (float) $station->latitude,
            'longitude' => $station->longitude === null ? null : (float) $station->longitude,
        ];
    }

    /**
     * Escales **purement informatives** : la réservation est point-à-point, et
     * une ville d'escale ne rend pas ce départ éligible à une recherche qui la
     * viserait (B6). Elles sont affichées, jamais réservables.
     *
     * @return list<array{city: string|null, position: int}>
     */
    private static function stops(Trip $trip): array
    {
        $route = $trip->route;

        if ($route === null) {
            return [];
        }

        $stops = [];

        foreach ($route->stops as $stop) {
            $stops[] = ['city' => $stop->city?->name, 'position' => $stop->position];
        }

        return $stops;
    }

    /**
     * Conditions **courantes** de l'agence : aucune réservation n'existe encore,
     * donc rien n'est figé. Le figement intervient à la création de la
     * réservation (B4) — c'est le seul endroit où lire les conditions vivantes
     * est correct.
     *
     * @return array<string, mixed>|null
     */
    private static function cancellationPolicy(Trip $trip): ?array
    {
        $terms = $trip->agency?->commercialTerms;

        if ($terms === null) {
            return null;
        }

        return [
            'deadline_hours' => $terms->cancellation_deadline_hours,
            'fee_type' => $terms->cancellation_fee_type,
            'fee_value' => $terms->cancellation_fee_value,
        ];
    }
}
