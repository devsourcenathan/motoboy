<?php

declare(strict_types=1);

namespace App\Modules\Places\Actions;

use App\Modules\Places\Data\PlaceSuggestion;
use App\Modules\Places\Models\City;
use App\Modules\Places\Models\Station;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Autocomplétion des lieux (B1).
 *
 * Propose **villes et gares**, mais une gare résout toujours vers sa ville : la
 * recherche s'exécute au niveau ville, la gare n'étant qu'une porte d'entrée
 * commode pour qui pense « Bonabéri » plutôt que « Douala ».
 *
 * La comparaison est insensible aux accents et à la casse. Ce n'est pas un
 * raffinement : sur un clavier de téléphone les accents ne sont pratiquement
 * jamais saisis, et une correspondance stricte échouerait sur une grande part
 * des saisies réelles.
 */
final class AutocompletePlaces
{
    /** @return list<PlaceSuggestion> */
    public function handle(string $query, int $limit = 10): array
    {
        $needle = self::normalize($query);

        /*
         * **Sans recherche, les villes les plus utiles.**
         *
         * Rendre une liste vide etait exact et inutilisable : le selecteur
         * s'ouvrait sur rien, et un passager qui ne sait pas quoi taper ne
         * decouvrait jamais ce que la plateforme dessert. Une liste de depart
         * repond aussi a la question « ou allez-vous ? » pour la majorite des
         * trajets, le pays n'ayant qu'une poignee d'axes frequentes.
         */
        if ($needle === '') {
            return $this->defaultCities($limit);
        }

        $cities = $this->matchCities($needle, $limit);

        // Les gares ne complètent la liste que s'il reste de la place : la ville
        // est la réponse attendue dans l'immense majorité des cas.
        $remaining = $limit - count($cities);
        $stations = $remaining > 0 ? $this->matchStations($query, $remaining) : [];

        return [...$cities, ...$stations];
    }

    /**
     * Les villes proposees quand rien n'est saisi.
     *
     * Par ordre alphabetique, faute de mieux : classer par frequentation
     * demanderait de compter les recherches, ce que la plateforme ne fait pas
     * encore. L'alphabetique a au moins le merite d'etre stable et previsible —
     * un ordre qui change a chaque ouverture desoriente plus qu'il n'aide.
     *
     * @return list<PlaceSuggestion>
     */
    private function defaultCities(int $limit): array
    {
        $cities = City::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->limit($limit)
            ->get();

        $suggestions = [];

        foreach ($cities as $city) {
            $suggestions[] = PlaceSuggestion::city($city->id, $city->name);
        }

        return $suggestions;
    }

    /** Minuscules, sans accent — la forme stockée dans `city_aliases.normalized`. */
    public static function normalize(string $value): string
    {
        return Str::lower(Str::ascii(trim($value)));
    }

    /** @return list<PlaceSuggestion> */
    private function matchCities(string $needle, int $limit): array
    {
        $pattern = $needle.'%';

        $cities = City::query()
            ->where('is_active', true)
            ->where(fn (Builder $q) => $q
                // `slug` est déjà normalisé par construction : il couvre le nom
                // canonique sans accent sans qu'un alias soit nécessaire.
                ->where('slug', 'like', $pattern)
                ->orWhereHas('aliases', fn (Builder $a) => $a->where('normalized', 'like', $pattern)))
            ->orderBy('name')
            ->limit($limit)
            ->get();

        $suggestions = [];

        foreach ($cities as $city) {
            $suggestions[] = PlaceSuggestion::city($city->id, $city->name);
        }

        return $suggestions;
    }

    /**
     * Les noms de gares ne sont pas stockés sous forme normalisée : la
     * correspondance est donc insensible à la casse mais **sensible aux
     * accents**. Acceptable tant que la gare reste une commodité ; à reprendre
     * par une colonne normalisée si le besoin se confirme.
     *
     * @return list<PlaceSuggestion>
     */
    private function matchStations(string $query, int $limit): array
    {
        $stations = Station::query()
            ->active()
            ->where('name', 'ilike', '%'.trim($query).'%')
            ->with('city')
            ->orderBy('name')
            ->limit($limit)
            ->get();

        $suggestions = [];

        foreach ($stations as $station) {
            $city = $station->city;

            // Une gare sans ville est une donnée incohérente : on ne la propose
            // pas plutôt que d'échouer, la recherche s'exécutant au niveau ville.
            if ($city === null) {
                continue;
            }

            $suggestions[] = PlaceSuggestion::station(
                cityId: $station->city_id,
                stationId: $station->id,
                label: $station->name,
                cityName: $city->name,
            );
        }

        return $suggestions;
    }
}
