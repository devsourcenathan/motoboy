<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Identity\Models\User;
use App\Modules\Places\Models\City;
use App\Modules\Rides\Enums\DriverStatus;
use App\Modules\Rides\Models\DriverProfile;
use Carbon\CarbonImmutable;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Le dossier d'un chauffeur indépendant (E2).
 *
 * Sans agence pour répondre d'un incident, ce dossier est la seule barrière
 * entre la plateforme et un chauffeur dont personne n'a vu le permis. Les
 * garde-fous sont donc testés ici, avant toute course.
 */
final class DriverProfileTest extends TestCase
{
    use RefreshDatabase;

    private City $city;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(CountrySeeder::class);
        $this->seed(CitySeeder::class);
        $this->city = City::query()->firstOrFail();
    }

    public function test_a_fresh_application_cannot_drive(): void
    {
        $profile = $this->profile();

        $this->assertSame(DriverStatus::Pending, $profile->status);
        $this->assertFalse($profile->canDrive());
    }

    public function test_only_an_approved_application_can_drive(): void
    {
        $profile = $this->profile(['status' => DriverStatus::Approved]);

        $this->assertTrue($profile->canDrive());

        foreach ([DriverStatus::Pending, DriverStatus::Rejected, DriverStatus::Suspended] as $status) {
            // Un refus exige son motif — c'est l'objet du test suivant.
            $profile->update([
                'status' => $status,
                'rejection_reason' => $status === DriverStatus::Rejected ? 'Permis illisible' : null,
            ]);

            $this->assertFalse($profile->refresh()->canDrive(), $status->value);
        }
    }

    /**
     * La validité du permis est saisie au dépôt et personne ne repasse derrière.
     * Sans ce contrôle, une validation d'il y a deux ans laisserait rouler
     * indéfiniment.
     */
    public function test_an_expired_licence_cannot_drive_even_once_approved(): void
    {
        $profile = $this->profile([
            'status' => DriverStatus::Approved,
            'license_expires_at' => CarbonImmutable::now()->subDay(),
        ]);

        $this->assertFalse($profile->canDrive());
    }

    /**
     * Un refus sans motif est inexploitable : le chauffeur ne saurait pas quoi
     * corriger, et le support non plus. C'est la base qui l'exige, parce qu'un
     * refus peut aussi venir d'une commande ou d'une reprise de données.
     */
    public function test_a_rejection_without_a_reason_is_refused_by_the_database(): void
    {
        $profile = $this->profile();

        $this->expectException(QueryException::class);

        $profile->update(['status' => DriverStatus::Rejected]);
    }

    public function test_a_person_holds_a_single_application(): void
    {
        $user = User::factory()->create();
        $this->profile(['user_id' => $user->id]);

        $this->expectException(QueryException::class);

        $this->profile(['user_id' => $user->id]);
    }

    /** @param array<string, mixed> $attributes */
    private function profile(array $attributes = []): DriverProfile
    {
        return DriverProfile::query()->create([
            'user_id' => User::factory()->create()->id,
            'license_number' => 'CM-'.fake()->unique()->numerify('######'),
            'license_expires_at' => CarbonImmutable::now()->addYear(),
            'vehicle_plate' => fake()->unique()->bothify('LT-###-??'),
            'vehicle_type' => VehicleType::Car,
            'vehicle_seats' => 4,
            'city_id' => $this->city->id,
            ...$attributes,
        ]);
    }
}
