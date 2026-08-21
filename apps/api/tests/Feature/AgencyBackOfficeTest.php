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

    /**
     * **Un horaire vendait pour toujours.**
     *
     * Créé, il produisait des départs sur tout l'horizon sans qu'aucun endpoint
     * ne puisse l'arrêter : `is_active` et `valid_until` existaient en base
     * depuis le début, et rien ne pouvait les écrire. Une ligne qui cesse d'être
     * desservie continuait donc d'être vendue, et les passagers l'apprenaient à
     * la gare.
     */
    public function test_a_schedule_can_be_stopped_and_stops_producing_departures(): void
    {
        $schedule = $this->buildSchedule();

        $premier = (new GenerateTrips)->handle($this->agency->id);
        $this->assertGreaterThan(0, $premier);

        $this->actingAs($this->manager)
            ->patchJson("/api/v1/agency/routes/{$schedule->route_id}/schedules/{$schedule->id}", [
                'is_active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('is_active', false);

        // Les départs **déjà créés** restent : les retirer annulerait des
        // réservations sans le dire. Seule la production s'arrête.
        Trip::query()->where('schedule_id', $schedule->id)->delete();

        $this->assertSame(0, (new GenerateTrips)->handle($this->agency->id));
    }

    /** Le tarif se corrige sans avoir à renvoyer les jours, qu'on écraserait. */
    public function test_a_schedule_price_changes_without_touching_its_days(): void
    {
        $schedule = $this->buildSchedule();

        $this->actingAs($this->manager)
            ->patchJson("/api/v1/agency/routes/{$schedule->route_id}/schedules/{$schedule->id}", [
                'price' => 8000,
            ])
            ->assertOk();

        $schedule->refresh();

        $this->assertSame(8000, $schedule->price);
        $this->assertSame([1, 2, 3, 4, 5, 6, 7], $schedule->days_of_week);
    }

    /**
     * **Une plaque mal saisie était définitive.** Le mode de placement, lui,
     * ne bouge pas : des départs vendus portent déjà un plan de sièges.
     */
    public function test_a_vehicle_is_correctable_but_never_reconfigured(): void
    {
        $vehicle = $this->agency->vehicles()->create([
            'registration' => 'LT-000', 'type' => 'BUS',
            'seating_mode' => 'SEATED', 'capacity' => 30, 'condition' => 'ACTIVE',
        ]);

        $this->actingAs($this->manager)
            ->patchJson("/api/v1/agency/vehicles/{$vehicle->id}", [
                'registration' => 'LT-123-AB',
                'condition' => 'RETIRED',
                'seating_mode' => 'CAPACITY',
                'capacity' => 99,
            ])
            ->assertOk();

        $vehicle->refresh();

        $this->assertSame('LT-123-AB', $vehicle->registration);
        $this->assertSame('RETIRED', $vehicle->condition);
        $this->assertSame('SEATED', $vehicle->seating_mode->value);
        $this->assertSame(30, $vehicle->capacity);
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

    /**
     * **Une agence en attente prépare tout, et ne publie rien.**
     *
     * Ce test affirmait l'inverse : que `PENDING` valait 403 sur l'espace
     * entier, y compris la liste de ses propres gares. La garde le faisait bel
     * et bien — et refermait le circuit sur lui-même, puisque l'admission exige
     * des pièces que l'agence ne pouvait plus déposer. Aucune agence ne pouvait
     * être admise autrement qu'en aveugle.
     *
     * L'intention était de ne rien publier ; la formulation interdisait aussi de
     * se préparer. Ce qu'il faut vraiment garantir est vérifié ici.
     */
    public function test_an_unapproved_agency_prepares_everything_and_publishes_nothing(): void
    {
        $this->buildSchedule();
        (new GenerateTrips)->handle($this->agency->id);

        $this->agency->update(['status' => 'PENDING']);

        // 1. Elle circule dans son espace : sans quoi elle ne peut pas déposer
        //    les pièces dont dépend son admission.
        $this->actingAs($this->manager)
            ->getJson('/api/v1/agency/stations')
            ->assertOk();

        $this->actingAs($this->manager)
            ->getJson('/api/v1/agency/documents')
            ->assertOk();

        // 2. Elle ne crée aucun départ — et le refus **dit lequel des deux**
        //    problèmes se pose. Un `FORBIDDEN` générique ferait lire « vous
        //    n'avez pas accès à cette ressource » à une agence qui vient de tout
        //    paramétrer, sans rien à faire de la réponse.
        $this->actingAs($this->manager)
            ->postJson('/api/v1/agency/trips/generate')
            ->assertStatus(403)
            ->assertJsonPath('code', 'AGENCY_NOT_APPROVED')
            ->assertJsonPath('details.status', 'PENDING');

        // 3. **Et ceux qui existent déjà disparaissent de la recherche.**
        //    C'est la garantie qui compte : elle porte sur le départ, pas sur le
        //    geste qui l'a créé, et vaut donc aussi pour un statut qui change
        //    après coup.
        $douala = City::query()->where('slug', 'douala')->firstOrFail();
        $bafoussam = City::query()->where('slug', 'bafoussam')->firstOrFail();
        $tomorrow = CarbonImmutable::now(config('app.display_timezone'))->addDay();

        $url = sprintf(
            '/api/v1/search?origin_city_id=%d&destination_city_id=%d&date=%s',
            $douala->id,
            $bafoussam->id,
            $tomorrow->toDateString(),
        );

        $this->assertCount(0, $this->getJson($url)->assertOk()->json('data'));

        // Et reparaissent à l'admission, sans rien régénérer : l'agence a bâti
        // son réseau pendant l'instruction, et tout paraît d'un coup.
        $this->agency->update(['status' => 'APPROVED']);

        $this->assertCount(1, $this->getJson($url)->assertOk()->json('data'));
    }

    /**
     * **Une agence en attente doit pouvoir lire son propre statut.**
     *
     * Elle entre désormais dans son espace sans attendre l'admission, et rien
     * ne le lui disait : le bandeau annonçait « MOTOBOY — agence », et ses
     * départs ne paraissaient pas dans la recherche sans qu'aucun écran
     * n'explique pourquoi. Le seul état qui rend cet endpoint nécessaire est
     * précisément celui qu'une garde d'admission lui interdirait.
     */
    public function test_an_agency_reads_its_own_name_and_status(): void
    {
        $this->agency->update(['status' => 'PENDING']);

        $this->actingAs($this->manager)
            ->getJson('/api/v1/agency')
            ->assertOk()
            ->assertJsonPath('name', 'Général Express')
            ->assertJsonPath('status', 'PENDING')
            ->assertJsonPath('reference', 'AG-TEST');
    }

    /**
     * Une candidature refusée est terminale — `ReviewAgency` ne transite que
     * depuis `PENDING`. Laisser l'espace ouvert ferait déposer des pièces que
     * personne n'instruira.
     */
    public function test_a_rejected_agency_keeps_nothing_open(): void
    {
        $this->agency->update(['status' => 'REJECTED']);

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
