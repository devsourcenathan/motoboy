<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Http\Controllers;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Agencies\Support\AgencyContext;
use App\Modules\Fleet\Models\Vehicle;
use App\Modules\Places\Models\Station;
use App\Modules\Routing\Models\Route;
use App\Modules\Routing\Models\Schedule;
use App\Modules\Trips\Actions\GenerateTrips;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Itinéraires et horaires récurrents.
 *
 * La `Route` n'est **jamais datée**, le `Trip` l'est toujours. Entre les deux,
 * le `Schedule` porte les horaires : une même liaison a souvent plusieurs
 * départs de nature différente — un VIP à 08:00 et un classique à 14:00 n'ont
 * ni le même véhicule ni le même tarif (I1).
 */
final class RoutingController
{
    public function __construct(private readonly AgencyContext $context) {}

    public function routes(Request $request): JsonResponse
    {
        $agency = $this->context->require($request);

        $routes = Route::query()
            ->where('agency_id', $agency->id)
            ->with('originCity', 'destinationCity', 'originStation', 'destinationStation', 'stops.city', 'schedules')
            ->get();

        return response()->json(['data' => $routes->map($this->presentRoute(...))->all()]);
    }

    public function storeRoute(Request $request): JsonResponse
    {
        $agency = $this->context->require($request);

        $validated = $request->validate([
            'origin_station_id' => ['required', 'integer'],
            'destination_station_id' => ['required', 'integer', 'different:origin_station_id'],
            'reference_duration_minutes' => ['nullable', 'integer', 'min:1', 'max:2880'],
            // Escales **purement informatives** : la réservation est
            // point-à-point, une ville d'escale ne rend pas le départ éligible
            // à une recherche qui la viserait (B6).
            'stops' => ['nullable', 'array', 'max:12'],
            'stops.*' => ['integer', 'exists:cities,id'],
        ]);

        $origin = $this->ownStation($agency, (int) $validated['origin_station_id']);
        $destination = $this->ownStation($agency, (int) $validated['destination_station_id']);

        if ($origin->city_id === $destination->city_id) {
            throw ApiException::of(
                ErrorCode::ValidationFailed,
                'Le départ et l\'arrivée sont dans la même ville.',
            );
        }

        $route = DB::transaction(function () use ($agency, $origin, $destination, $validated): Route {
            $route = Route::query()->create([
                'agency_id' => $agency->id,
                'origin_city_id' => $origin->city_id,
                'destination_city_id' => $destination->city_id,
                'origin_station_id' => $origin->id,
                'destination_station_id' => $destination->id,
                'reference_duration_minutes' => $validated['reference_duration_minutes'] ?? null,
                'is_active' => true,
            ]);

            foreach (array_values($validated['stops'] ?? []) as $position => $cityId) {
                $route->stops()->create(['city_id' => $cityId, 'position' => $position + 1]);
            }

            return $route;
        });

        return response()->json($this->presentRoute($route->load(
            'originCity', 'destinationCity', 'originStation', 'destinationStation', 'stops.city', 'schedules',
        )), 201);
    }

    public function storeSchedule(Request $request, int $routeId): JsonResponse
    {
        $agency = $this->context->require($request);
        $route = Route::query()->whereKey($routeId)->firstOrFail();

        $this->context->own($agency, $route->agency_id);

        $validated = $request->validate([
            'departure_time' => ['required', 'date_format:H:i'],
            'days_of_week' => ['required', 'array', 'min:1', 'max:7'],
            'days_of_week.*' => ['integer', 'between:1,7'],
            'default_vehicle_id' => ['required', 'integer'],
            'default_driver_id' => ['nullable', 'integer'],
            'price' => ['required', 'integer', 'min:0'],
            'valid_from' => ['required', 'date'],
            'valid_until' => ['nullable', 'date', 'after:valid_from'],
        ]);

        $vehicle = Vehicle::query()->whereKey($validated['default_vehicle_id'])->firstOrFail();
        $this->context->own($agency, $vehicle->agency_id);

        $schedule = Schedule::query()->create([
            'route_id' => $route->id,
            ...$validated,
            'currency' => 'XAF',
            'is_active' => true,
        ]);

        return response()->json($this->presentSchedule($schedule), 201);
    }

    /**
     * Génère les départs manquants sur l'horizon glissant.
     *
     * Exposé pour que l'agence voie immédiatement l'effet d'un horaire qu'elle
     * vient de créer : attendre le job quotidien lui laisserait croire que rien
     * ne s'est passé.
     */
    public function generate(Request $request, GenerateTrips $generate): JsonResponse
    {
        $agency = $this->context->requireApproved($request);

        return response()->json([
            'created' => $generate->handle($agency->id),
            'horizon_days' => GenerateTrips::HORIZON_DAYS,
        ]);
    }

    private function ownStation(Agency $agency, int $id): Station
    {
        $station = Station::query()->whereKey($id)->firstOrFail();

        // Une agence ne construit d'itinéraire qu'entre **ses** gares : sans ce
        // contrôle, elle publierait des départs au nom d'une autre.
        $this->context->own($agency, $station->agency_id);

        return $station;
    }

    /** @return array<string, mixed> */
    private function presentRoute(Route $route): array
    {
        return [
            'id' => $route->id,
            'origin' => [
                'city' => $route->originCity?->name,
                'station' => $route->originStation?->name,
            ],
            'destination' => [
                'city' => $route->destinationCity?->name,
                'station' => $route->destinationStation?->name,
            ],
            'reference_duration_minutes' => $route->reference_duration_minutes,
            'stops' => $route->stops->map(fn ($stop): array => [
                'city' => $stop->city?->name,
                'position' => $stop->position,
            ])->all(),
            'schedules' => $route->schedules->map($this->presentSchedule(...))->all(),
            'is_active' => $route->is_active,
        ];
    }

    /** @return array<string, mixed> */
    private function presentSchedule(Schedule $schedule): array
    {
        return [
            'id' => $schedule->id,
            'departure_time' => $schedule->departure_time,
            'days_of_week' => $schedule->days_of_week,
            'default_vehicle_id' => $schedule->default_vehicle_id,
            'default_driver_id' => $schedule->default_driver_id,
            'price' => ['amount' => $schedule->price, 'currency' => $schedule->currency],
            'valid_from' => $schedule->valid_from->toDateString(),
            'valid_until' => $schedule->valid_until?->toDateString(),
            'is_active' => $schedule->is_active,
        ];
    }
}
