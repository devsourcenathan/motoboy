<?php

declare(strict_types=1);

namespace App\Modules\Trips\Actions;

use App\Modules\Fleet\Models\Vehicle;
use App\Modules\Routing\Models\Route;
use App\Modules\Routing\Models\Schedule;
use App\Support\Reference;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Génère les départs manquants depuis les horaires récurrents (I1).
 *
 * **C'est ce qui fait vivre ou mourir l'offre.** Si une agence doit ressaisir
 * ses six départs quotidiens chaque matin, elle arrêtera au bout d'une semaine,
 * et l'application affichera des données mortes — ce qui tue un comparateur plus
 * sûrement qu'une absence d'offre.
 */
final class GenerateTrips
{
    /** Horizon glissant. Plus court, on ne peut plus réserver pour les fêtes. */
    public const HORIZON_DAYS = 30;

    /** @return int Nombre de départs créés. */
    public function handle(?int $agencyId = null): int
    {
        $timezone = config('app.display_timezone');
        $today = CarbonImmutable::now(is_string($timezone) ? $timezone : 'UTC')->startOfDay();

        $schedules = Schedule::query()
            ->generatable()
            ->when($agencyId !== null, fn ($q) => $q->whereHas(
                'route',
                fn ($r) => $r->where('agency_id', $agencyId),
            ))
            ->with('route', 'defaultVehicle')
            ->get();

        $created = 0;

        foreach ($schedules as $schedule) {
            $created += $this->generateFor($schedule, $today);
        }

        return $created;
    }

    private function generateFor(Schedule $schedule, CarbonImmutable $today): int
    {
        $route = $schedule->route;
        $vehicle = $schedule->defaultVehicle;

        // Un horaire sans véhicule ne peut pas produire de départ : la capacité
        // et le mode d'inventaire en viennent. On l'ignore plutôt que d'inventer.
        if ($route === null || $vehicle === null) {
            return 0;
        }

        /** @var list<int> $days */
        $days = $schedule->days_of_week ?? [];

        $rows = [];

        for ($offset = 0; $offset < self::HORIZON_DAYS; $offset++) {
            $date = $today->addDays($offset);

            if (!in_array($date->dayOfWeekIso, $days, true)) {
                continue;
            }

            if ($schedule->valid_until !== null && $date->greaterThan($schedule->valid_until)) {
                break;
            }

            $departure = $this->departureAt($date, (string) $schedule->departure_time);

            // Le passé ne se génère pas : au premier passage du jour, l'horaire
            // du matin peut déjà être écoulé.
            if ($departure->isPast()) {
                continue;
            }

            $rows[] = $this->row($schedule, $route, $vehicle, $departure);
        }

        if ($rows === []) {
            return 0;
        }

        /*
         * `insertOrIgnore` s'appuie sur l'unicité `(schedule_id, departure_at)`.
         *
         * La génération **ne modifie jamais un départ existant** : elle ne crée
         * que ce qui manque. Sans cette règle, une régénération écraserait un
         * départ portant déjà des réservations — et modifier un horaire
         * n'affecterait plus seulement les départs futurs (I1).
         */
        return DB::table('trips')->insertOrIgnore($rows);
    }

    private function departureAt(CarbonImmutable $date, string $time): CarbonImmutable
    {
        [$hour, $minute] = array_pad(array_map(intval(...), explode(':', $time)), 2, 0);

        return $date->setTime($hour, $minute)->utc();
    }

    /**
     * @return array<string, mixed>
     */
    private function row(
        Schedule $schedule,
        Route $route,
        Vehicle $vehicle,
        CarbonImmutable $departure,
    ): array {
        // La fenêtre de vente vient des conditions de l'agence : elle est
        // paramétrable, et la valeur par défaut de B2 ne sert que de filet.
        $terms = $route->agency?->commercialTerms;
        $cutoff = $terms === null ? 30 : $terms->online_sales_cutoff_minutes;
        $duration = $route->reference_duration_minutes;

        return [
            'reference' => Reference::generate('TR'),
            'agency_id' => $route->agency_id,
            'route_id' => $route->id,
            'schedule_id' => $schedule->id,
            // Dénormalisées depuis la route : la recherche filtre sur le couple
            // de villes et la jointure serait payée à chaque appel.
            'origin_city_id' => $route->origin_city_id,
            'destination_city_id' => $route->destination_city_id,
            'origin_station_id' => $route->origin_station_id,
            'destination_station_id' => $route->destination_station_id,
            'departure_at' => $departure,
            'arrival_estimate_at' => $duration === null ? null : $departure->addMinutes($duration),
            'online_sales_close_at' => $departure->subMinutes($cutoff),
            'vehicle_id' => $vehicle->id,
            'driver_id' => $schedule->default_driver_id,
            // Tarif figé à la génération : modifier l'horaire n'affecte que les
            // départs créés ensuite (I1).
            'price' => $schedule->price,
            'currency' => $schedule->currency,
            'seating_mode' => $vehicle->seating_mode->value,
            'capacity' => $vehicle->capacity,
            'seats_taken' => 0,
            'status' => 'SCHEDULED',
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }
}
