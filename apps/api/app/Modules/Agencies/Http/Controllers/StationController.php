<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Http\Controllers;

use App\Modules\Agencies\Support\AgencyContext;
use App\Modules\Places\Models\CityRequest;
use App\Modules\Places\Models\Station;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gares de l'agence (B1).
 *
 * Une gare **appartient à une agence** et se crée sans validation préalable :
 * la modération est a posteriori, car bloquer une agence motivée pendant
 * plusieurs jours la ferait renoncer.
 */
final class StationController
{
    public function __construct(private readonly AgencyContext $context) {}

    public function index(Request $request): JsonResponse
    {
        $agency = $this->context->require($request);

        $stations = Station::query()
            ->where('agency_id', $agency->id)
            ->with('city')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $stations->map($this->present(...))->all()]);
    }

    public function store(Request $request): JsonResponse
    {
        $agency = $this->context->require($request);

        $validated = $request->validate([
            // Les villes sont une **liste fermée** curée par MOTOBOY : si chaque
            // agence pouvait créer la sienne, « Douala », « douala » et « Dla »
            // coexisteraient et la recherche cesserait de regrouper les offres.
            'city_id' => ['required', 'integer', 'exists:cities,id'],
            'name' => ['required', 'string', 'max:150'],
            'address' => ['nullable', 'string', 'max:500'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $station = Station::query()->create([
            'agency_id' => $agency->id,
            'city_id' => $validated['city_id'],
            'name' => $validated['name'],
            'address' => $validated['address'] ?? null,
            'latitude' => $validated['latitude'] ?? null,
            'longitude' => $validated['longitude'] ?? null,
            'is_active' => true,
        ]);

        return response()->json($this->present($station->load('city')), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $agency = $this->context->require($request);
        $station = Station::query()->whereKey($id)->firstOrFail();

        $this->context->own($agency, $station->agency_id);

        $station->update($request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'address' => ['nullable', 'string', 'max:500'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'is_active' => ['sometimes', 'boolean'],
        ]));

        return response()->json($this->present($station->load('city')));
    }

    /**
     * Demande d'ajout d'une ville absente du référentiel.
     *
     * Sans ce circuit, une agence desservant une ville manquante est bloquée
     * sans recours et abandonne (B1).
     */
    public function requestCity(Request $request): JsonResponse
    {
        $agency = $this->context->require($request);

        $validated = $request->validate([
            'country_id' => ['required', 'integer', 'exists:countries,id'],
            'requested_name' => ['required', 'string', 'max:120'],
        ]);

        $requested = CityRequest::query()->create([
            'agency_id' => $agency->id,
            'country_id' => $validated['country_id'],
            'requested_name' => $validated['requested_name'],
            'status' => 'PENDING',
        ]);

        return response()->json([
            'id' => $requested->id,
            'requested_name' => $requested->requested_name,
            'status' => $requested->status,
        ], 201);
    }

    /** @return array<string, mixed> */
    private function present(Station $station): array
    {
        return [
            'id' => $station->id,
            'name' => $station->name,
            'city' => $station->city?->name,
            'city_id' => $station->city_id,
            'address' => $station->address,
            'latitude' => $station->latitude === null ? null : (float) $station->latitude,
            'longitude' => $station->longitude === null ? null : (float) $station->longitude,
            'is_active' => $station->is_active,
            'moderated_at' => $station->moderated_at?->toIso8601String(),
        ];
    }
}
