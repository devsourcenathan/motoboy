<?php

declare(strict_types=1);

namespace App\Modules\Places\Data;

/**
 * Suggestion d'autocomplétion.
 *
 * `cityId` est **toujours** renseigné, y compris quand la suggestion est une
 * gare : c'est la cible réelle de la recherche, qui s'exécute au niveau ville.
 */
final readonly class PlaceSuggestion
{
    private function __construct(
        public string $type,
        public int $cityId,
        public ?int $stationId,
        public string $label,
        public ?string $secondaryLabel,
    ) {}

    public static function city(int $cityId, string $name): self
    {
        return new self('CITY', $cityId, null, $name, null);
    }

    public static function station(int $cityId, int $stationId, string $label, string $cityName): self
    {
        return new self('STATION', $cityId, $stationId, $label, $cityName);
    }
}
