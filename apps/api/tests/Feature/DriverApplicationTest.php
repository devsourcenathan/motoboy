<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Identity\Enums\Role as RoleEnum;
use App\Modules\Identity\Models\Role;
use App\Modules\Identity\Models\User;
use App\Modules\Places\Models\City;
use App\Modules\Rides\Enums\DriverDocumentType;
use App\Modules\Rides\Enums\DriverStatus;
use App\Modules\Rides\Models\DriverProfile;
use Carbon\CarbonImmutable;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Dépôt et instruction d'un dossier chauffeur (E2).
 *
 * Sans agence pour répondre d'un incident, cette instruction est la seule
 * barrière entre la plateforme et un chauffeur dont personne n'a vu le permis.
 */
final class DriverApplicationTest extends TestCase
{
    use RefreshDatabase;

    private City $city;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(CountrySeeder::class);
        $this->seed(CitySeeder::class);
        $this->seed(RoleAndPermissionSeeder::class);

        $this->city = City::query()->firstOrFail();
    }

    public function test_a_submission_waits_and_grants_the_role(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/v1/driver', $this->application())
            ->assertCreated()
            ->assertJsonPath('status', DriverStatus::Pending->value)
            // Le rôle décide des onglets, pas du droit de rouler.
            ->assertJsonPath('can_drive', false);

        $roleId = Role::query()->where('name', RoleEnum::Driver->value)->value('id');

        $this->assertDatabaseHas('role_user', ['user_id' => $user->id, 'role_id' => $roleId]);
    }

    /**
     * Un permis mal photographié ne doit pas condamner le compte : sinon le
     * chauffeur en ouvre un second avec un autre numéro, ce que la validation
     * cherche précisément à empêcher.
     */
    public function test_a_rejected_file_can_be_corrected_and_resubmitted(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/v1/driver', $this->application())->assertCreated();

        $profile = DriverProfile::query()->where('user_id', $user->id)->firstOrFail();
        $profile->update([
            'status' => DriverStatus::Rejected,
            'review_note' => 'Permis illisible',
        ]);

        $this->actingAs($user)
            ->postJson('/api/v1/driver', $this->application(['vehicle_plate' => 'LT-999-ZZ']))
            ->assertCreated()
            ->assertJsonPath('status', DriverStatus::Pending->value)
            // Le motif précédent disparaît : le laisser le ferait réapparaître
            // sur un dossier corrigé.
            ->assertJsonPath('review_note', null);
    }

    /**
     * Les quatre pièces sont tout ce dont la plateforme dispose en cas
     * d'incident. Valider sans elles reviendrait à n'avoir rien vérifié tout en
     * l'ayant écrit.
     */
    public function test_an_incomplete_file_cannot_be_approved(): void
    {
        $profile = $this->submitted();

        $this->actingAs($this->admin())
            ->postJson("/api/v1/admin/drivers/{$profile->id}/approve")
            ->assertStatus(422);

        $this->assertSame(DriverStatus::Pending, $profile->refresh()->status);
    }

    public function test_a_complete_file_is_approved_and_logged(): void
    {
        $profile = $this->submitted();
        $this->attachEveryDocument($profile);

        $this->actingAs($this->admin())
            ->postJson("/api/v1/admin/drivers/{$profile->id}/approve")
            ->assertOk()
            ->assertJsonPath('status', DriverStatus::Approved->value)
            ->assertJsonPath('can_drive', true);

        // Une décision prise sur le compte d'un autre : §28 veut savoir qui.
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'driver.approved',
            'auditable_id' => $profile->id,
        ]);
    }

    public function test_a_rejection_requires_its_reason(): void
    {
        $profile = $this->submitted();

        $this->actingAs($this->admin())
            ->postJson("/api/v1/admin/drivers/{$profile->id}/reject", [])
            ->assertStatus(422);

        $this->actingAs($this->admin())
            ->postJson("/api/v1/admin/drivers/{$profile->id}/reject", ['note' => 'Carte grise absente'])
            ->assertOk()
            ->assertJsonPath('status', DriverStatus::Rejected->value)
            ->assertJsonPath('review_note', 'Carte grise absente');
    }

    /**
     * Suspendre n'est pas effacer : l'historique et les reversements dus
     * survivent.
     */
    public function test_a_suspension_keeps_the_file_and_stops_the_driving(): void
    {
        $profile = $this->submitted();
        $this->attachEveryDocument($profile);

        $admin = $this->admin();
        $this->actingAs($admin)->postJson("/api/v1/admin/drivers/{$profile->id}/approve")->assertOk();

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/drivers/{$profile->id}/suspend", ['note' => 'Plainte passager'])
            ->assertOk()
            ->assertJsonPath('can_drive', false);

        $this->assertDatabaseHas('driver_profiles', [
            'id' => $profile->id,
            'status' => DriverStatus::Suspended->value,
        ]);
    }

    public function test_the_queue_holds_what_awaits_a_decision(): void
    {
        $this->submitted();

        $this->actingAs($this->admin())
            ->getJson('/api/v1/admin/drivers')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }

    public function test_a_passenger_reaches_neither_the_queue_nor_a_decision(): void
    {
        $profile = $this->submitted();
        $passenger = User::factory()->create();

        $this->actingAs($passenger)->getJson('/api/v1/admin/drivers')->assertForbidden();
        $this->actingAs($passenger)
            ->postJson("/api/v1/admin/drivers/{$profile->id}/approve")
            ->assertForbidden();
    }

    public function test_a_file_is_read_only_by_its_owner(): void
    {
        $this->submitted();

        // Sans dossier à soi, il n'y a rien à lire — et aucun identifiant d'URL
        // ne permet d'en viser un autre.
        $this->actingAs(User::factory()->create())
            ->getJson('/api/v1/driver')
            ->assertNotFound();
    }

    /** @param array<string, mixed> $overrides */
    private function application(array $overrides = []): array
    {
        return [
            'license_number' => 'CM-'.fake()->unique()->numerify('######'),
            'license_expires_at' => CarbonImmutable::now()->addYear()->toDateString(),
            'vehicle_plate' => fake()->unique()->bothify('LT-###-??'),
            'vehicle_type' => 'CAR',
            'vehicle_seats' => 4,
            'city_id' => $this->city->id,
            ...$overrides,
        ];
    }

    private function submitted(): DriverProfile
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/driver', $this->application())->assertCreated();

        return DriverProfile::query()->where('user_id', $user->id)->firstOrFail();
    }

    private function attachEveryDocument(DriverProfile $profile): void
    {
        foreach (DriverDocumentType::cases() as $type) {
            $profile->documents()->create([
                'type' => $type,
                'file_path' => "drivers/{$profile->id}/".$type->value.'.pdf',
            ]);
        }
    }

    private function admin(): User
    {
        $admin = User::factory()->create();

        DB::table('role_user')->insert([
            'user_id' => $admin->id,
            'role_id' => Role::query()->where('name', RoleEnum::Admin->value)->value('id'),
        ]);

        return $admin;
    }
}
