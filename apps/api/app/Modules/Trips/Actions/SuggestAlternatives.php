<?php

declare(strict_types=1);

namespace App\Modules\Trips\Actions;

use App\Modules\Trips\Data\SearchCriteria;
use App\Modules\Trips\Models\Trip;
use App\Support\DisplayTimezone;
use Illuminate\Support\Facades\DB;

/**
 * Repli affiché quand la recherche ne renvoie rien ([I9](../../../../../docs/BRIEF.md)).
 *
 * Au lancement, avec une couverture encore faible, la recherche vide sera
 * fréquente — et un passager déçu deux fois ne revient pas. Les suggestions
 * voyagent dans **la même réponse** que les résultats : un seul aller-retour, et
 * le client a toujours quelque chose à afficher.
 */
final class SuggestAlternatives
{
    private const NEARBY_DAYS = 3;

    private const MAX_ROUTES = 6;

    /**
     * @return array{
     *     nearby_dates: list<array{date: string, trips_count: int, lowest_price: array{amount: int, currency: string}}>,
     *     routes_served: list<array{destination_city_id: int, destination_city: string, trips_count: int}>
     * }
     */
    public function handle(SearchCriteria $criteria): array
    {
        return [
            'nearby_dates' => $this->nearbyDates($criteria),
            'routes_served' => $this->routesServed($criteria),
        ];
    }

    /**
     * Dates proches sur le **même axe** : c'est la suggestion la plus utile,
     * puisqu'elle garde l'intention du passager intacte.
     *
     * @return list<array{date: string, trips_count: int, lowest_price: array{amount: int, currency: string}}>
     */
    private function nearbyDates(SearchCriteria $criteria): array
    {
        $localDate = DisplayTimezone::localExpression('departure_at', '::date');

        /** @var list<object{day: string, trips_count: int, lowest_price: int, currency: string}> $rows */
        $rows = Trip::query()
            ->openForOnlineSale()
            ->where('origin_city_id', $criteria->originCityId)
            ->where('destination_city_id', $criteria->destinationCityId)
            ->whereBetween('departure_at', [
                $criteria->date->subDays(self::NEARBY_DAYS)->startOfDay(),
                $criteria->date->addDays(self::NEARBY_DAYS)->endOfDay(),
            ])
            ->havingSeatsFor($criteria->passengers)
            ->select([
                DisplayTimezone::localExpressionAs('departure_at', '::date', 'day'),
                DB::raw('count(*) as trips_count'),
                DB::raw('min(price) as lowest_price'),
                DB::raw('min(currency) as currency'),
            ])
            ->groupBy($localDate)
            ->orderBy($localDate)
            ->get()
            ->all();

        /*
         * **Un `Money`, comme le contrat le promet.**
         *
         * Le montant partait en entier nu, la devise dans un champ voisin, alors
         * que `docs/openapi.yaml` declare `lowest_price: Money`. Le mobile faisait
         * confiance au contrat et lisait `.amount` sur un entier : l'ecran des
         * resultats vides affichait « des NaN undefined ». Le contrat etant
         * normatif, c'est l'implementation qui avait tort.
         */
        return array_values(array_map(
            static fn (object $row): array => [
                'date' => $row->day,
                'trips_count' => (int) $row->trips_count,
                'lowest_price' => [
                    'amount' => (int) $row->lowest_price,
                    'currency' => (string) $row->currency,
                ],
            ],
            array_filter($rows, static fn (object $row): bool => $row->day !== ''),
        ));
    }

    /**
     * Axes desservis au départ de la même ville.
     *
     * **La destination demandée n'est pas exclue**, et c'est délibéré. Le cas
     * qui fait le plus mal n'est pas « cette destination n'existe pas » mais
     * « elle existe, mais pas à la date que vous avez choisie » : si l'on
     * retirait Bafoussam d'une recherche Douala → Bafoussam sans résultat, et
     * que la date demandée est trop lointaine pour que les dates proches
     * remontent quoi que ce soit, le passager recevrait une réponse
     * entièrement vide alors que l'axe est desservi tous les jours.
     *
     * @return list<array{destination_city_id: int, destination_city: string, trips_count: int}>
     */
    private function routesServed(SearchCriteria $criteria): array
    {
        /** @var list<object{destination_city_id: int, destination_city: string, trips_count: int}> $rows */
        $rows = Trip::query()
            ->openForOnlineSale()
            ->where('origin_city_id', $criteria->originCityId)
            ->join('cities', 'cities.id', '=', 'trips.destination_city_id')
            ->groupBy('trips.destination_city_id', 'cities.name')
            ->orderByRaw('count(*) desc')
            ->limit(self::MAX_ROUTES)
            ->select([
                'trips.destination_city_id',
                'cities.name as destination_city',
                DB::raw('count(*) as trips_count'),
            ])
            ->get()
            ->all();

        return array_map(
            static fn (object $row): array => [
                'destination_city_id' => (int) $row->destination_city_id,
                'destination_city' => $row->destination_city,
                'trips_count' => (int) $row->trips_count,
            ],
            $rows,
        );
    }
}
