<?php

declare(strict_types=1);

namespace App\Modules\Trips\Http\Requests;

use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Trips\Data\SearchCriteria;
use App\Modules\Trips\Data\SearchSort;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * La validation vit ici, pas dans le contrôleur ni dans l'Action (§4 du
 * standard de code). L'Action reçoit un objet typé et reste testable sans
 * couche web.
 */
final class SearchRequest extends FormRequest
{
    /**
     * Accepte `true` et `false` en toutes lettres.
     *
     * Le contrat déclare `only_available` comme un booléen, et la sérialisation
     * canonique d'un booléen en paramètre de requête est `true`/`false` — c'est
     * ce qu'émettent les clients générés depuis la spec. Or la règle `boolean`
     * de Laravel ne reconnaît que `1`, `0`, `"1"` et `"0"` : le serveur
     * refusait donc en 422 ce que son propre contrat décrit, et le filtre
     * revenait vide sans que rien n'explique pourquoi.
     */
    protected function prepareForValidation(): void
    {
        $value = $this->query('only_available');

        if ($value === 'true' || $value === 'false') {
            $this->merge(['only_available' => $value === 'true']);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'origin_city_id' => ['required', 'integer', 'exists:cities,id'],
            'destination_city_id' => ['required', 'integer', 'different:origin_city_id', 'exists:cities,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'passengers' => ['integer', 'min:1', 'max:20'],

            'price_min' => ['nullable', 'integer', 'min:0'],
            'price_max' => ['nullable', 'integer', 'min:0', 'gte:price_min'],

            // Heures locales de pendule, pas des instants.
            'departure_from' => ['nullable', 'date_format:H:i'],
            'departure_to' => ['nullable', 'date_format:H:i'],

            'agency_ids' => ['nullable', 'array'],
            'agency_ids.*' => ['integer', 'exists:agencies,id'],

            'vehicle_type' => ['nullable', Rule::enum(VehicleType::class)],
            'only_available' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::enum(SearchSort::class)],
        ];
    }

    public function criteria(): SearchCriteria
    {
        /** @var list<int> $agencyIds */
        $agencyIds = array_map(intval(...), (array) $this->input('agency_ids', []));

        $vehicleType = $this->input('vehicle_type');
        $sort = $this->input('sort');

        return new SearchCriteria(
            originCityId: $this->integer('origin_city_id'),
            destinationCityId: $this->integer('destination_city_id'),
            date: CarbonImmutable::parse($this->string('date')->toString()),
            passengers: $this->integer('passengers', 1),
            priceMin: $this->has('price_min') ? $this->integer('price_min') : null,
            priceMax: $this->has('price_max') ? $this->integer('price_max') : null,
            departureFrom: is_string($departureFrom = $this->input('departure_from')) ? $departureFrom : null,
            departureTo: is_string($departureTo = $this->input('departure_to')) ? $departureTo : null,
            agencyIds: $agencyIds,
            vehicleType: is_string($vehicleType) ? VehicleType::from($vehicleType) : null,
            onlyAvailable: $this->boolean('only_available'),
            sort: is_string($sort) ? SearchSort::from($sort) : SearchSort::Best,
        );
    }
}
