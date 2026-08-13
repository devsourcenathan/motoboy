<?php

declare(strict_types=1);

namespace App\Modules\Trips\Data;

use App\Modules\Fleet\Enums\VehicleType;
use Carbon\CarbonImmutable;

/**
 * Critères de recherche, validés en amont.
 *
 * L'Action reçoit un objet typé, jamais une requête HTTP : la validation vit
 * dans une `FormRequest` et l'Action reste testable sans couche web (§4 du
 * standard de code).
 */
final readonly class SearchCriteria
{
    /** @param list<int> $agencyIds */
    public function __construct(
        public int $originCityId,
        public int $destinationCityId,
        public CarbonImmutable $date,
        public int $passengers = 1,
        public ?int $priceMin = null,
        public ?int $priceMax = null,
        public ?string $departureFrom = null,
        public ?string $departureTo = null,
        public array $agencyIds = [],
        public ?VehicleType $vehicleType = null,
        public bool $onlyAvailable = false,
        public SearchSort $sort = SearchSort::Best,
    ) {}
}
