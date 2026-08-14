<?php

declare(strict_types=1);

namespace App\Modules\Trips\Actions;

use App\Modules\Trips\Data\SearchCriteria;
use App\Modules\Trips\Data\SearchSort;
use App\Modules\Trips\Models\Trip;
use App\Support\DisplayTimezone;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Requête centrale du produit.
 *
 * Le filtrage porte sur le couple **ville de départ / ville d'arrivée**. La
 * réservation étant point-à-point, une ville d'escale ne rend pas un trajet
 * éligible ([B6](../../../../../docs/BRIEF.md)) — d'où l'absence de jointure sur
 * `route_stops` ici, qui serait une erreur et non un oubli.
 */
final class SearchTrips
{
    /** @return Collection<int, Trip> */
    public function handle(SearchCriteria $criteria): Collection
    {
        return $this->query($criteria)->get();
    }

    /** @return Builder<Trip> */
    public function query(SearchCriteria $criteria): Builder
    {
        $query = Trip::query()
            ->openForOnlineSale()
            ->where('origin_city_id', $criteria->originCityId)
            ->where('destination_city_id', $criteria->destinationCityId)
            ->whereBetween('departure_at', [
                $criteria->date->startOfDay(),
                $criteria->date->endOfDay(),
            ])
            ->withAvailability()
            ->with([
                'agency',
                'originStation.city',
                'destinationStation.city',
                'vehicle',
                'route.stops.city',
                'agency.commercialTerms',
            ]);

        $this->applyFilters($query, $criteria);
        $this->applySort($query, $criteria->sort);

        return $query;
    }

    /** @param Builder<Trip> $query */
    private function applyFilters(Builder $query, SearchCriteria $criteria): void
    {
        $query
            ->when($criteria->priceMin !== null, fn (Builder $q) => $q->where('price', '>=', $criteria->priceMin))
            ->when($criteria->priceMax !== null, fn (Builder $q) => $q->where('price', '<=', $criteria->priceMax))
            ->when($criteria->agencyIds !== [], fn (Builder $q) => $q->whereIn('agency_id', $criteria->agencyIds))
            ->when(
                $criteria->vehicleType !== null,
                fn (Builder $q) => $q->whereHas('vehicle', fn (Builder $v) => $v->where('type', $criteria->vehicleType)),
            );

        // Les heures saisies sont locales — une heure de pendule, pas un
        // instant. Il faut donc extraire l'heure locale du timestamp, sans quoi
        // « à partir de 08:00 » filtrerait sur l'heure UTC.
        $localTime = DisplayTimezone::localExpression('departure_at', '::time');

        $query
            ->when(
                $criteria->departureFrom !== null,
                fn (Builder $q) => $q->where($localTime, '>=', $criteria->departureFrom),
            )
            ->when(
                $criteria->departureTo !== null,
                fn (Builder $q) => $q->where($localTime, '<=', $criteria->departureTo),
            );

        $query->when(
            $criteria->onlyAvailable,
            fn (Builder $q) => $q->havingSeatsFor($criteria->passengers),
        );
    }

    /** @param Builder<Trip> $query */
    private function applySort(Builder $query, SearchSort $sort): void
    {
        match ($sort) {
            SearchSort::Best => $query->orderBy('price')->orderBy('departure_at'),
            SearchSort::PriceAsc => $query->orderBy('price')->orderBy('departure_at'),
            SearchSort::DepartureAsc => $query->orderBy('departure_at')->orderBy('price'),
            SearchSort::DurationAsc => $query
                ->orderByRaw('arrival_estimate_at - departure_at nulls last')
                ->orderBy('price'),
        };
    }
}
