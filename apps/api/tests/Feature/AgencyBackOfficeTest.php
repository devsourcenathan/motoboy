<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Agencies\Models\AgencyCommercialTerms;
use App\Modules\Identity\Enums\Role as RoleEnum;
use App\Modules\Identity\Models\Role;
use App\Modules\Identity\Models\User;
use App\Modules\Places\Models\City;
use App\Modules\Places\Models\Country;
use App\Modules\Routing\Models\Schedule;
use App\Modules\Trips\Actions\GenerateTrips;
use App\Modules\Trips\Models\Trip;
use Carbon\CarbonImmutable;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * La chaîne qui rend l'offre cherchable.
 *
 * Sans elle, la recherche ne renvoie rien et le produit n'existe pas — d'où sa
 * place en parallèle du parcours passager, et non après.
 */
final class AgencyBackOfficeTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(CountrySeeder::class);
        $this->seed(CitySeeder::class);
        $this->seed(RoleAndPermissionSeeder::class);

        $this->agency = Agency::query()->create([
            'reference' => 'AG-TEST',
            'name' => 'Général Express',
            'phone' => '+237690000100',
            'status' => 'APPROVED',
        ]);

        AgencyCommercialTerms::query()->create([
            'agency_id' => $this->agency->id,
            'commission_value' => 800,
            'online_sales_cutoff_minutes' => 30,
        ]);

        $this->manager = $this->userWithAgencyRole($this->agency);
    }

    /**
     * Même règle pour l'agent d'embarquement, et pour la même raison : son
     * numéro devient un compte. `AgencyStaffController` retrouve d'ailleurs
     * l'existant par `where('phone', ...)` — deux formats du même numéro y
     * désigneraient deux personnes.
     */
    public function test_staff_creation_refuses_a_number_without_its_dialling_code(): void
    {
        $this->actingAs($this->manager)->postJson('/api/v1/agency/staff', [
            'phone' => '651212331',
            'first_name' => 'Bertin',
            'last_name' => 'Mbarga',
            'role' => 'AGENT',
        ])->assertStatus(422)->assertJsonValidationErrors('phone');

        $this->assertDatabaseMissing('users', ['phone' => '651212331']);
    }

    public function test_an_agency_builds_its_network_until_trips_are_searchable(): void
    {
        $douala = City::query()->where('slug', 'douala')->firstOrFail();
        $bafoussam = City::query()->where('slug', 'bafoussam')->firstOrFail();

        // 1. Les gares. La ville vient du référentiel fermé ; la gare, elle,
        //    appartient à l'agence et se publie sans validation préalable (B1).
        $origin = $this->actingAs($this->manager)
            ->postJson('/api/v1/agency/stations', [
                'city_id' => $douala->id,
                'name' => 'Gare de Bonabéri',
            ])->assertCreated()->json('id');

        $destination = $this->actingAs($this->manager)
            ->postJson('/api/v1/agency/stations', [
                'city_id' => $bafoussam->id,
                'name' => 'Gare de Bafoussam',
            ])->assertCreated()->json('id');

        // 2. Le véhicule. Le plan de sièges est généré : demander à une agence
        //    de créer trente sièges un par un garantirait qu'elle ne le fasse pas.
        $vehicle = $this->actingAs($this->manager)
            ->postJson('/api/v1/agency/vehicles', [
                'registration' => 'LT-001-AB',
                'type' => 'BUS',
                'seating_mode' => 'SEATED',
                'capacity' => 30,
            ])->assertCreated()->json();

        $this->assertSame(30, $vehicle['seats_count']);

        $seats = $this->actingAs($this->manager)
            ->getJson("/api/v1/agency/vehicles/{$vehicle['id']}/seats")
            ->assertOk()->json('data');

        $this->assertSame('A1', $seats[0]['label']);
        $this->assertCount(30, $seats);

        // 3. L'itinéraire, jamais daté.
        $route = $this->actingAs($this->manager)
            ->postJson('/api/v1/agency/routes', [
                'origin_station_id' => $origin,
                'destination_station_id' => $destination,
                'reference_duration_minutes' => 300,
            ])->assertCreated()->json();

        // 4. L'horaire récurrent. Sans lui, l'agence ressaisirait ses départs
        //    chaque matin et abandonnerait en une semaine (I1).
        $this->actingAs($this->manager)
            ->postJson("/api/v1/agency/routes/{$route['id']}/schedules", [
                'departure_time' => '08:00',
                'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
                'default_vehicle_id' => $vehicle['id'],
                'price' => 6500,
                'valid_from' => CarbonImmutable::today()->toDateString(),
            ])->assertCreated();

        // 5. La génération.
        $generated = $this->actingAs($this->manager)
            ->postJson('/api/v1/agency/trips/generate')
            ->assertOk()->json();

        $this->assertGreaterThan(25, $generated['created']);
        $this->assertSame(GenerateTrips::HORIZON_DAYS, $generated['horizon_days']);

        // 6. Et le passager trouve le départ — la boucle est bouclée.
        $tomorrow = CarbonImmutable::now(config('app.display_timezone'))->addDay();

        $results = $this->getJson(sprintf(
            '/api/v1/search?origin_city_id=%d&destination_city_id=%d&date=%s',
            $douala->id,
            $bafoussam->id,
            $tomorrow->toDateString(),
        ))->assertOk()->json('data');

        $this->assertCount(1, $results);
        $this->assertSame(6500, $results[0]['price']['amount']);
        $this->assertSame(30, $results[0]['seats_available']);
    }

    public function test_generation_never_touches_an_existing_departure(): void
    {
        $schedule = $this->buildSchedule();

        $first = (new GenerateTrips)->handle($this->agency->id);
        $trip = Trip::query()->where('schedule_id', $schedule->id)->orderBy('departure_at')->firstOrFail();

        // Le tarif change pour les départs **futurs**, pas pour ceux déjà créés.
        $schedule->update(['price' => 9999]);

        $second = (new GenerateTrips)->handle($this->agency->id);

        $this->assertGreaterThan(0, $first);
        $this->assertSame(0, $second, 'La seconde génération aurait dû ne rien créer.');
        $this->assertSame(6500, $trip->refresh()->price);
    }

    public function test_an_agency_cannot_build_on_another_agency_station(): void
    {
        $other = Agency::query()->create([
            'reference' => 'AG-AUTRE',
            'name' => 'Western Voyages',
            'phone' => '+237690000200',
            'status' => 'APPROVED',
        ]);

        $douala = City::query()->where('slug', 'douala')->firstOrFail();

        $foreign = $this->actingAs($this->userWithAgencyRole($other))
            ->postJson('/api/v1/agency/stations', [
                'city_id' => $douala->id,
                'name' => 'Gare adverse',
            ])->assertCreated()->json('id');

        $mine = $this->actingAs($this->manager)
            ->postJson('/api/v1/agency/stations', [
                'city_id' => City::query()->where('slug', 'bafoussam')->firstOrFail()->id,
                'name' => 'Ma gare',
            ])->assertCreated()->json('id');

        // Sans ce contrôle, une agence publierait des départs au nom d'une
        // autre. La réponse est `NOT_FOUND` : dire « interdit » confirmerait
        // l'existence de la gare et permettrait d'énumérer un concurrent.
        $this->actingAs($this->manager)
            ->postJson('/api/v1/agency/routes', [
                'origin_station_id' => $foreign,
                'destination_station_id' => $mine,
            ])
            ->assertStatus(404)
            ->assertJsonPath('code', 'NOT_FOUND');
    }

    public function test_an_unapproved_agency_publishes_nothing(): void
    {
        $this->agency->update(['status' => 'PENDING']);

        $this->actingAs($this->manager)
            ->getJson('/api/v1/agency/stations')
            ->assertStatus(403)
            ->assertJsonPath('code', 'FORBIDDEN');
    }

    public function test_a_passenger_reaches_no_back_office(): void
    {
        $this->actingAs(User::factory()->create())
            ->getJson('/api/v1/agency/vehicles')
            ->assertStatus(403);
    }

    public function test_a_missing_city_can_be_requested_instead_of_blocking(): void
    {
        $country = Country::query()->where('code', 'CM')->firstOrFail();

        // Sans ce circuit, une agence desservant une ville absente est bloquée
        // sans recours et abandonne (B1).
        $this->actingAs($this->manager)
            ->postJson('/api/v1/agency/city-requests', [
                'country_id' => $country->id,
                'requested_name' => 'Mamfé',
            ])
            ->assertCreated()
            ->assertJsonPath('status', 'PENDING');
    }

    private function buildSchedule(): Schedule
    {
        $douala = City::query()->where('slug', 'douala')->firstOrFail();
        $bafoussam = City::query()->where('slug', 'bafoussam')->firstOrFail();

        $origin = $this->agency->stations()->create([
            'city_id' => $douala->id, 'name' => 'Gare A', 'is_active' => true,
        ]);
        $destination = $this->agency->stations()->create([
            'city_id' => $bafoussam->id, 'name' => 'Gare B', 'is_active' => true,
        ]);

        $vehicle = $this->agency->vehicles()->create([
            'registration' => 'LT-999', 'type' => 'BUS',
            'seating_mode' => 'CAPACITY', 'capacity' => 20, 'condition' => 'ACTIVE',
        ]);

        $route = $this->agency->routes()->create([
            'origin_city_id' => $douala->id,
            'destination_city_id' => $bafoussam->id,
            'origin_station_id' => $origin->id,
            'destination_station_id' => $destination->id,
            'reference_duration_minutes' => 300,
            'is_active' => true,
        ]);

        return $route->schedules()->create([
            'departure_time' => '08:00',
            'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
            'default_vehicle_id' => $vehicle->id,
            'price' => 6500,
            'currency' => 'XAF',
            'valid_from' => CarbonImmutable::today()->toDateString(),
            'is_active' => true,
        ]);
    }

    private function userWithAgencyRole(Agency $agency): User
    {
        $user = User::factory()->create();

        DB::table('role_user')->insert([
            'user_id' => $user->id,
            'role_id' => Role::query()->where('name', RoleEnum::Agency->value)->value('id'),
            'agency_id' => $agency->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $user;
    }
}
