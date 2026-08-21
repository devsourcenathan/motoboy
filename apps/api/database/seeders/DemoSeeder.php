<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Identity\Enums\Role;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

/**
 * Données de démonstration — **jamais en production**.
 *
 * Objectif : avoir de quoi exercer réellement la recherche et la réservation.
 * Deux agences sur les mêmes axes, pour que la comparaison ait un sens, et un
 * axe anglophone — Douala–Bamenda — pour que l'interface soit éprouvée dans les
 * deux langues (I10).
 *
 * Les deux modes d'inventaire sont représentés : un car avec plan de sièges et
 * un véhicule à capacité simple, puisque les mécanismes de concurrence diffèrent
 * (B2).
 */
final class DemoSeeder extends Seeder
{
    private const DAYS_AHEAD = 7;

    /**
     * Les hôtes qu'on accepte de semer.
     *
     * Un nom **sans point** est un service local — `postgres` d'un
     * docker-compose, `db` d'un conteneur de CI. Tout ce qui porte un domaine
     * est ailleurs, et « ailleurs » est la seule chose qui compte ici.
     */
    private const LOCAL_HOSTS = ['', 'localhost', '127.0.0.1', '::1'];

    public function run(): void
    {
        $this->refuseRemoteDatabase();

        $countryId = (int) DB::table('countries')->where('code', 'CM')->value('id');

        $cities = $this->cityIds($countryId);
        $passengerId = $this->seedPassenger();

        $agencyA = $this->seedAgency('Général Express', '+237690000101', 'fr');
        $agencyB = $this->seedAgency('Western Voyages', '+237690000102', 'en');

        $this->seedNetwork($agencyA, $cities, seated: true);
        $this->seedNetwork($agencyB, $cities, seated: false);

        $this->say("Démonstration : 2 agences, {$this->tripCount()} départs sur ".self::DAYS_AHEAD.' jours.');
        $this->say("Passager de test : +237690000001 (id {$passengerId}).");
    }

    /**
     * **Refuser une base distante, et non un environnement mal nommé.**
     *
     * `DatabaseSeeder` gardait déjà ces données derrière `app()->environment()`
     * — une étiquette, portée par la configuration du client et non par la base
     * qu'il vise. Un poste de développement branché sur la production, ce que la
     * documentation recommande faute de shell chez l'hébergeur, porte
     * `APP_ENV=local` **et** parle à Neon : la garde laissait passer, et deux
     * agences fictives se sont mises à vendre cent soixante-quatorze départs
     * dans la recherche publique.
     *
     * Le seul fait qui répond à la question « est-ce que je peux semer ici ? »
     * est l'adresse de la base. C'est donc elle qu'on regarde.
     */
    /**
     * L'hôte désigne-t-il une base **ailleurs** ?
     *
     * Publique et statique parce que c'est la seule chose ici qui mérite un
     * test, et que l'éprouver autrement demanderait de résoudre une connexion —
     * ce qui, sous `RefreshDatabase`, la connecte pour de bon.
     *
     * Un nom **sans point** est un service local : `postgres` d'un
     * docker-compose, `db` d'un conteneur de CI. Tout ce qui porte un domaine
     * est ailleurs, et « ailleurs » est la seule chose qui compte.
     */
    public static function isRemote(string $host): bool
    {
        return !in_array($host, self::LOCAL_HOSTS, true) && str_contains($host, '.');
    }

    private function refuseRemoteDatabase(): void
    {
        /*
         * `DB::connection()->getConfig()` et **non** `config()`.
         *
         * La connexion vient de `DB_URL`, que Laravel n'éclate en hôte, port et
         * base qu'au moment de se connecter. `config()` rend donc le défaut du
         * fichier — `127.0.0.1` — quelle que soit la base réellement visée. La
         * première version de cette garde lisait cela, et aurait laissé semer
         * sur Neon en affirmant le contraire : une fausse sécurité est pire que
         * pas de garde du tout.
         */
        $host = (string) DB::connection()->getConfig('host');

        if (!self::isRemote($host)) {
            return;
        }

        throw new RuntimeException(
            "Base distante ({$host}) : les données de démonstration ne s'y sèment pas. ".
            'Viser une base locale, ou lancer les seeders de référentiel un par un — '.
            'par exemple `--class=RoleAndPermissionSeeder`.',
        );
    }

    /** @return array<string, int> */
    private function cityIds(int $countryId): array
    {
        /** @var array<string, int> $ids */
        $ids = DB::table('cities')
            ->where('country_id', $countryId)
            ->whereIn('slug', ['douala', 'yaounde', 'bafoussam', 'bamenda'])
            ->pluck('id', 'slug')
            ->all();

        return $ids;
    }

    private function seedPassenger(): int
    {
        DB::table('users')->upsert(
            [[
                'phone' => '+237690000001',
                'email' => 'passager@motoboy.test',
                'password' => Hash::make('password'),
                'first_name' => 'Awa',
                'last_name' => 'Nkeng',
                'locale' => 'fr',
                'phone_verified_at' => now(),
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]],
            uniqueBy: ['phone'],
            update: ['first_name', 'last_name', 'updated_at'],
        );

        $userId = (int) DB::table('users')->where('phone', '+237690000001')->value('id');
        $roleId = (int) DB::table('roles')->where('name', Role::Passenger->value)->value('id');

        /*
         * Vérification puis insertion, plutôt qu'un `upsert`.
         *
         * L'unicité de `role_user` est portée par deux index **partiels** — un
         * pour les rôles rattachés à une agence, un pour les rôles globaux.
         * PostgreSQL n'infère un `ON CONFLICT` depuis un index partiel que si le
         * prédicat est répété dans la requête, ce que le constructeur de
         * requêtes de Laravel n'expose pas.
         *
         * Toute attribution de rôle doit donc suivre ce motif. C'est le prix du
         * choix fait dans la migration, et il valait la peine : une clé primaire
         * composite aurait forcé `agency_id` en NOT NULL et cassé les rôles
         * globaux.
         */
        $alreadyAssigned = DB::table('role_user')
            ->where('user_id', $userId)
            ->where('role_id', $roleId)
            ->whereNull('agency_id')
            ->exists();

        if (!$alreadyAssigned) {
            DB::table('role_user')->insert([
                'user_id' => $userId,
                'role_id' => $roleId,
                'agency_id' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $userId;
    }

    private function seedAgency(string $name, string $phone, string $locale): int
    {
        $reference = 'AG-'.strtoupper(substr(md5($name), 0, 6));

        DB::table('agencies')->upsert(
            [[
                'reference' => $reference,
                'name' => $name,
                'phone' => $phone,
                'default_locale' => $locale,
                'status' => 'APPROVED',
                'approved_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]],
            uniqueBy: ['reference'],
            update: ['name', 'default_locale', 'updated_at'],
        );

        $agencyId = (int) DB::table('agencies')->where('reference', $reference)->value('id');

        // Conditions commerciales : les valeurs par défaut de B4. Commission à
        // 8 %, frais d'annulation à 20 % dans la fenêtre.
        DB::table('agency_commercial_terms')->upsert(
            [[
                'agency_id' => $agencyId,
                'commission_type' => 'PERCENTAGE',
                'commission_value' => 800,
                'fee_bearer' => 'PLATFORM',
                'payout_delay_hours' => 24,
                'payout_frequency' => 'WEEKLY',
                'payout_day' => 1,
                'payout_minimum_amount' => 5000,
                'counter_sale_commission_enabled' => false,
                'counter_sale_sms_enabled' => true,
                'cancellation_deadline_hours' => 2,
                'cancellation_fee_type' => 'PERCENTAGE',
                'cancellation_fee_value' => 2000,
                'hold_duration_minutes' => 10,
                'online_sales_cutoff_minutes' => 30,
                'created_at' => now(),
                'updated_at' => now(),
            ]],
            uniqueBy: ['agency_id'],
            update: ['updated_at'],
        );

        return $agencyId;
    }

    /** @param array<string, int> $cities */
    private function seedNetwork(int $agencyId, array $cities, bool $seated): void
    {
        $stations = [];
        foreach ($cities as $slug => $cityId) {
            $stations[$slug] = $this->seedStation($agencyId, $cityId, $slug);
        }

        $vehicleId = $this->seedVehicle($agencyId, $seated);
        $driverId = $this->seedDriver($agencyId, $vehicleId);

        // Douala–Bamenda est volontairement présent : c'est l'axe anglophone qui
        // justifie de servir les deux langues dès le lancement (I10).
        $axes = [
            ['douala', 'yaounde', 5500, 240, '07:00'],
            ['douala', 'bafoussam', 6500, 300, '08:00'],
            ['douala', 'bamenda', 9000, 420, '06:30'],
        ];

        foreach ($axes as [$from, $to, $price, $duration, $time]) {
            if (!isset($stations[$from], $stations[$to])) {
                continue;
            }

            $routeId = $this->seedRoute($agencyId, $cities, $stations, $from, $to, $duration);
            $scheduleId = $this->seedSchedule($routeId, $vehicleId, $driverId, $price, $time);
            $this->generateTrips($agencyId, $routeId, $scheduleId, $vehicleId, $driverId, $price, $time);
        }
    }

    private function seedStation(int $agencyId, int $cityId, string $slug): int
    {
        $name = 'Gare '.ucfirst($slug);

        $existing = DB::table('stations')
            ->where('agency_id', $agencyId)
            ->where('city_id', $cityId)
            ->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        return (int) DB::table('stations')->insertGetId([
            'agency_id' => $agencyId,
            'city_id' => $cityId,
            'name' => $name,
            'is_active' => true,
            'moderated_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedVehicle(int $agencyId, bool $seated): int
    {
        $registration = $seated ? 'LT-'.$agencyId.'-SEAT' : 'LT-'.$agencyId.'-CAP';
        $capacity = $seated ? 30 : 18;

        $existing = DB::table('vehicles')
            ->where('agency_id', $agencyId)
            ->where('registration', $registration)
            ->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        $vehicleId = (int) DB::table('vehicles')->insertGetId([
            'agency_id' => $agencyId,
            'registration' => $registration,
            'brand' => $seated ? 'Toyota' : 'Mercedes',
            'model' => $seated ? 'Coaster' : 'Sprinter',
            'type' => ($seated ? VehicleType::Bus : VehicleType::Car)->value,
            'seating_mode' => ($seated ? SeatingMode::Seated : SeatingMode::Capacity)->value,
            'capacity' => $capacity,
            'condition' => 'ACTIVE',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($seated) {
            $this->seedSeats($vehicleId, $capacity);
        }

        return $vehicleId;
    }

    /** Plan de sièges : quatre par rangée, libellés A1 à A4, B1 à B4… */
    private function seedSeats(int $vehicleId, int $capacity): void
    {
        $rows = [];
        for ($index = 0; $index < $capacity; $index++) {
            $row = intdiv($index, 4);
            $column = $index % 4;

            $rows[] = [
                'vehicle_id' => $vehicleId,
                'label' => chr(65 + $row).($column + 1),
                'row_index' => $row + 1,
                'column_index' => $column + 1,
                'is_bookable' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        DB::table('vehicle_seats')->insertOrIgnore($rows);
    }

    private function seedDriver(int $agencyId, int $vehicleId): int
    {
        $license = 'DL-'.$agencyId.'-01';

        $existing = DB::table('drivers')
            ->where('agency_id', $agencyId)
            ->where('license_number', $license)
            ->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        return (int) DB::table('drivers')->insertGetId([
            'agency_id' => $agencyId,
            'first_name' => 'Emmanuel',
            'last_name' => 'Tchoumi',
            'phone' => '+2376900002'.$agencyId,
            'license_number' => $license,
            'assigned_vehicle_id' => $vehicleId,
            'status' => 'ACTIVE',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param array<string, int> $cities
     * @param array<string, int> $stations
     */
    private function seedRoute(
        int $agencyId,
        array $cities,
        array $stations,
        string $from,
        string $to,
        int $duration,
    ): int {
        $existing = DB::table('routes')
            ->where('agency_id', $agencyId)
            ->where('origin_city_id', $cities[$from])
            ->where('destination_city_id', $cities[$to])
            ->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        return (int) DB::table('routes')->insertGetId([
            'agency_id' => $agencyId,
            'origin_city_id' => $cities[$from],
            'destination_city_id' => $cities[$to],
            'origin_station_id' => $stations[$from],
            'destination_station_id' => $stations[$to],
            'reference_duration_minutes' => $duration,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedSchedule(int $routeId, int $vehicleId, int $driverId, int $price, string $time): int
    {
        $existing = DB::table('schedules')
            ->where('route_id', $routeId)
            ->where('departure_time', $time)
            ->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        return (int) DB::table('schedules')->insertGetId([
            'route_id' => $routeId,
            'departure_time' => $time,
            'days_of_week' => json_encode([1, 2, 3, 4, 5, 6, 7]),
            'default_vehicle_id' => $vehicleId,
            'default_driver_id' => $driverId,
            'price' => $price,
            'currency' => 'XAF',
            'valid_from' => CarbonImmutable::today()->toDateString(),
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Préfiguration de l'action `GenerateTrips` (I1) : la génération ne crée que
     * les départs manquants et ne modifie jamais un départ existant.
     */
    private function generateTrips(
        int $agencyId,
        int $routeId,
        int $scheduleId,
        int $vehicleId,
        int $driverId,
        int $price,
        string $time,
    ): void {
        /** @var object{origin_city_id: int, destination_city_id: int, origin_station_id: int, destination_station_id: int, reference_duration_minutes: int|null}|null $route */
        $route = DB::table('routes')->where('id', $routeId)->first();

        if ($route === null) {
            return;
        }

        /** @var object{seating_mode: string, capacity: int}|null $vehicle */
        $vehicle = DB::table('vehicles')->where('id', $vehicleId)->first();

        if ($vehicle === null) {
            return;
        }

        $rows = [];

        for ($day = 0; $day < self::DAYS_AHEAD; $day++) {
            [$hour, $minute] = array_map(intval(...), explode(':', $time));

            $departure = CarbonImmutable::today('Africa/Douala')
                ->addDays($day)
                ->setTime($hour, $minute)
                ->utc();

            $rows[] = [
                'reference' => 'TR-'.strtoupper(substr(md5($scheduleId.$departure->toIso8601String()), 0, 8)),
                'agency_id' => $agencyId,
                'route_id' => $routeId,
                'schedule_id' => $scheduleId,
                'origin_city_id' => $route->origin_city_id,
                'destination_city_id' => $route->destination_city_id,
                'origin_station_id' => $route->origin_station_id,
                'destination_station_id' => $route->destination_station_id,
                'departure_at' => $departure,
                'arrival_estimate_at' => $departure->addMinutes($route->reference_duration_minutes ?? 240),
                'online_sales_close_at' => $departure->subMinutes(30),
                'vehicle_id' => $vehicleId,
                'driver_id' => $driverId,
                'price' => $price,
                'currency' => 'XAF',
                'seating_mode' => $vehicle->seating_mode,
                'capacity' => $vehicle->capacity,
                'seats_taken' => 0,
                'status' => 'SCHEDULED',
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        // `insertOrIgnore` s'appuie sur l'unicité (schedule_id, departure_at) :
        // rejouer le seeder ne duplique aucun départ et n'écrase rien.
        DB::table('trips')->insertOrIgnore($rows);
    }

    private function tripCount(): int
    {
        return DB::table('trips')->count();
    }

    /** Voir DatabaseSeeder::say(). */
    private function say(string $message): void
    {
        $this->command->info($message);
    }
}
