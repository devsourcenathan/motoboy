<?php

declare(strict_types=1);

namespace Tests\Feature\Support;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Agencies\Models\AgencyCommercialTerms;
use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Fleet\Models\Vehicle;
use App\Modules\Identity\Enums\Locale;
use App\Modules\Places\Models\City;
use App\Modules\Places\Models\Country;
use App\Modules\Places\Models\Station;
use App\Modules\Routing\Models\Route;
use App\Modules\Trips\Models\Trip;
use Carbon\CarbonImmutable;

/**
 * Réseau minimal mais réaliste : deux agences sur les mêmes axes — sans quoi
 * il n'y a rien à comparer — et les deux modes d'inventaire, dont les
 * mécanismes de concurrence diffèrent.
 */
trait BuildsSearchFixtures
{
    /** @var array<string, int> */
    private array $cities = [];

    /** @var array<string, int> */
    private array $stations = [];

    private function buildNetwork(): void
    {
        $country = Country::query()->where('code', 'CM')->firstOrFail();

        foreach (['douala', 'bafoussam', 'bamenda', 'nkongsamba'] as $slug) {
            $city = City::query()->firstOrCreate(
                ['country_id' => $country->id, 'slug' => $slug],
                ['name' => ucfirst($slug), 'is_active' => true],
            );

            $this->cities[$slug] = $city->id;
        }

        $today = CarbonImmutable::now(config('app.display_timezone'));

        $this->buildTrip('TR-SEATED', 'douala', 'bafoussam', $today->setTime(8, 0), 6500, seated: true);
        $this->buildTrip('TR-CAPACITY', 'douala', 'bafoussam', $today->setTime(14, 0), 5000, seated: false);
    }

    private function buildTrip(
        string $reference,
        string $from,
        string $to,
        CarbonImmutable $departure,
        int $price,
        bool $seated,
    ): Trip {
        $agency = $this->agency($seated ? 'Général Express' : 'Western Voyages', $seated ? 'fr' : 'en');
        $vehicle = $this->vehicle($agency, $seated);

        $origin = $this->station($agency, $from);
        $destination = $this->station($agency, $to);

        $route = Route::query()->firstOrCreate([
            'agency_id' => $agency->id,
            'origin_city_id' => $this->cities[$from],
            'destination_city_id' => $this->cities[$to],
        ], [
            'origin_station_id' => $origin,
            'destination_station_id' => $destination,
            'reference_duration_minutes' => 300,
        ]);

        // Escale déclarée sur l'axe Douala–Bafoussam : elle doit s'afficher sans
        // jamais rendre le départ éligible à une recherche qui la viserait (B6).
        if ($from === 'douala' && $to === 'bafoussam' && $route->stops()->count() === 0) {
            $route->stops()->create(['city_id' => $this->cities['nkongsamba'], 'position' => 1]);
        }

        return Trip::query()->create([
            'reference' => $reference,
            'agency_id' => $agency->id,
            'route_id' => $route->id,
            'origin_city_id' => $this->cities[$from],
            'destination_city_id' => $this->cities[$to],
            'origin_station_id' => $origin,
            'destination_station_id' => $destination,
            'departure_at' => $departure->utc(),
            'arrival_estimate_at' => $departure->addMinutes(300)->utc(),
            'online_sales_close_at' => CarbonImmutable::now()->addYear(),
            'vehicle_id' => $vehicle->id,
            'price' => $price,
            'currency' => 'XAF',
            'seating_mode' => $seated ? SeatingMode::Seated : SeatingMode::Capacity,
            'capacity' => $seated ? 30 : 18,
            'status' => 'SCHEDULED',
        ]);
    }

    private function agency(string $name, string $locale): Agency
    {
        $agency = Agency::query()->firstOrCreate(
            ['reference' => 'AG-'.strtoupper(substr(md5($name), 0, 4))],
            [
                'name' => $name,
                'phone' => '+237690'.random_int(100000, 999999),
                'default_locale' => Locale::from($locale),
                'status' => 'APPROVED',
            ],
        );

        AgencyCommercialTerms::query()->firstOrCreate(['agency_id' => $agency->id], [
            'commission_type' => 'PERCENTAGE',
            'commission_value' => 800,
            'fee_bearer' => 'PLATFORM',
            'cancellation_deadline_hours' => 2,
            'cancellation_fee_type' => 'PERCENTAGE',
            'cancellation_fee_value' => 2000,
        ]);

        return $agency;
    }

    private function vehicle(Agency $agency, bool $seated): Vehicle
    {
        $vehicle = Vehicle::query()->firstOrCreate(
            ['agency_id' => $agency->id, 'registration' => $seated ? 'LT-SEAT' : 'LT-CAP'],
            [
                'type' => $seated ? VehicleType::Bus : VehicleType::Car,
                'seating_mode' => $seated ? SeatingMode::Seated : SeatingMode::Capacity,
                'capacity' => $seated ? 30 : 18,
                'condition' => 'ACTIVE',
            ],
        );

        if ($seated && $vehicle->seats()->count() === 0) {
            for ($index = 0; $index < 30; $index++) {
                $vehicle->seats()->create([
                    'label' => chr(65 + intdiv($index, 4)).($index % 4 + 1),
                    'row_index' => intdiv($index, 4) + 1,
                    'column_index' => $index % 4 + 1,
                ]);
            }
        }

        return $vehicle;
    }

    private function station(Agency $agency, string $slug): int
    {
        $key = $agency->id.':'.$slug;

        return $this->stations[$key] ??= Station::query()->firstOrCreate(
            ['agency_id' => $agency->id, 'city_id' => $this->cities[$slug]],
            ['name' => 'Gare '.ucfirst($slug), 'is_active' => true, 'moderated_at' => now()],
        )->id;
    }

    private function searchUrl(string $from, string $to, ?string $date = null): string
    {
        $date ??= CarbonImmutable::now(config('app.display_timezone'))->toDateString();

        return sprintf(
            '/api/v1/search?origin_city_id=%d&destination_city_id=%d&date=%s',
            $this->cities[$from],
            $this->cities[$to],
            $date,
        );
    }
}
