<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Identity\Models\User;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Models\Payment;
use App\Modules\Places\Models\City;
use App\Modules\Rides\Actions\ExpireServiceRequests;
use App\Modules\Rides\Enums\DriverStatus;
use App\Modules\Rides\Enums\OfferStatus;
use App\Modules\Rides\Enums\RideStatus;
use App\Modules\Rides\Enums\ServiceRequestStatus;
use App\Modules\Rides\Models\DriverProfile;
use App\Modules\Rides\Models\RideOffer;
use App\Modules\Rides\Models\ServiceRequest;
use Carbon\CarbonImmutable;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Le parcours complet d'un appel de service, par les endpoints (E1).
 *
 * Ce que ce fichier protège en priorité : **on ne voit que ce qui est à soi**, et
 * le téléphone d'un chauffeur ne circule qu'une fois la course conclue.
 */
final class RideEndpointTest extends TestCase
{
    use RefreshDatabase;

    private City $origin;

    private City $destination;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(CountrySeeder::class);
        $this->seed(CitySeeder::class);

        $cities = City::query()->orderBy('id')->limit(2)->get();
        $this->origin = $cities->firstOrFail();
        $this->destination = $cities->last() ?? $this->origin;
    }

    public function test_the_whole_journey_from_request_to_completed_ride(): void
    {
        $passenger = User::factory()->create();
        $driver = $this->driver();

        $reference = $this->actingAs($passenger)
            ->postJson('/api/v1/service-requests', $this->payload())
            ->assertCreated()
            ->assertJsonPath('status', ServiceRequestStatus::Open->value)
            ->json('reference');

        $this->assertIsString($reference);

        $offerId = $this->actingAs($this->userOf($driver))
            ->postJson("/api/v1/service-requests/{$reference}/offers", [
                'price_amount' => 6_000,
                'eta_minutes' => 15,
            ])
            ->assertCreated()
            ->json('id');

        // Le passager compare : c'est la promesse du produit appliquée à un autre
        // inventaire que les départs programmés.
        $this->actingAs($passenger)
            ->getJson("/api/v1/service-requests/{$reference}")
            ->assertOk()
            ->assertJsonPath('status', ServiceRequestStatus::Offered->value)
            ->assertJsonCount(1, 'offers')
            // Le téléphone du chauffeur n'est **pas** dans une offre.
            ->assertJsonMissingPath('offers.0.driver.phone');

        $rideReference = $this->actingAs($passenger)
            ->postJson("/api/v1/offers/{$offerId}/accept")
            ->assertCreated()
            ->assertJsonPath('status', RideStatus::Matched->value)
            // Le vehicule oui, le telephone pas encore : rien n'a ete paye.
            ->assertJsonPath('driver.vehicle_plate', $driver->vehicle_plate)
            ->assertJsonPath('driver.phone', null)
            ->json('reference');

        $this->assertIsString($rideReference);

        /*
         * **Le paiement fait partie du parcours nominal** (E4 bis, decision 1) :
         * tout se regle a l'acceptation. Ce test l'omettait, et conduisait donc une
         * course entiere sans qu'un franc ait bouge.
         */
        $this->actingAs($passenger)
            ->withHeader('Idempotency-Key', 'cle-du-parcours')
            ->postJson("/api/v1/rides/{$rideReference}/payments", [
                'method' => 'MOBILE_MONEY',
                'operator' => 'MTN',
            ])
            ->assertAccepted();

        // Le pilote factice n'encaisse jamais de facon synchrone : on confirme.
        Payment::query()->whereNotNull('ride_id')->update([
            'status' => PaymentStatus::Succeeded->value,
            'paid_at' => now(),
        ]);

        // Payee : les deux parties peuvent enfin se joindre.
        $this->actingAs($passenger)
            ->getJson("/api/v1/service-requests/{$reference}")
            ->assertOk()
            ->assertJsonPath('ride.paid', true)
            ->assertJsonPath('ride.driver.phone', $this->userOf($driver)->phone);

        $this->actingAs($this->userOf($driver))
            ->postJson("/api/v1/driver/rides/{$rideReference}/start")
            ->assertOk()
            ->assertJsonPath('status', RideStatus::InProgress->value);

        $this->actingAs($this->userOf($driver))
            ->postJson("/api/v1/driver/rides/{$rideReference}/complete")
            ->assertOk()
            ->assertJsonPath('status', RideStatus::Completed->value);
    }

    /**
     * Une course terminée libère le chauffeur : l'index partiel ne porte que sur
     * les états actifs, sinon un chauffeur ne roulerait qu'une fois.
     */
    public function test_a_completed_ride_frees_the_driver_for_the_next_one(): void
    {
        $driver = $this->driver();

        $first = $this->ride($driver);
        $this->actingAs($this->userOf($driver))->postJson("/api/v1/driver/rides/{$first}/start")->assertOk();
        $this->actingAs($this->userOf($driver))->postJson("/api/v1/driver/rides/{$first}/complete")->assertOk();

        // Une seconde course devient possible.
        $this->assertMatchesRegularExpression('/^RID-/', $this->ride($driver));
    }

    /**
     * Les téléphones ne partent qu'une fois la course payée.
     *
     * **La règle était tenue par l'écran seul**, ce qui ne la tenait pas : le
     * numéro du chauffeur figurait dans la réponse dès l'acceptation, et il
     * suffisait de lire le JSON pour l'avoir sans payer — donc pour s'arranger
     * hors plateforme, sans commission et sans recours. Elle est désormais dans la
     * ressource, et ce test est ce qui l'y maintient.
     */
    public function test_no_phone_number_travels_before_the_ride_is_paid(): void
    {
        $driver = $this->driver();
        $reference = $this->ride($driver);

        $asDriver = $this->actingAs($this->userOf($driver))
            ->getJson('/api/v1/driver/rides')
            ->assertOk();

        $asDriver->assertJsonPath('data.0.paid', false);
        $asDriver->assertJsonPath('data.0.passenger.phone', null);
        $asDriver->assertJsonPath('data.0.driver.phone', null);

        // Le véhicule, lui, est connu dès l'acceptation : c'est ce qui permet de
        // reconnaître la voiture, et il n'identifie personne à lui seul.
        $asDriver->assertJsonPath('data.0.driver.vehicle_plate', $driver->vehicle_plate);

        $this->assertStringStartsWith('RID-', $reference);
    }

    /**
     * Le net du chauffeur est calculé par le serveur.
     *
     * Le taux se règle depuis le dashboard : recopier 10 % dans le mobile
     * annoncerait un montant faux le lendemain d'un changement, et le chauffeur ne
     * s'en apercevrait qu'au reversement.
     */
    public function test_a_ride_states_what_the_driver_receives(): void
    {
        $driver = $this->driver();
        $this->ride($driver);

        $response = $this->actingAs($this->userOf($driver))
            ->getJson('/api/v1/driver/rides')
            ->assertOk();

        // 6 000 F au prix, 10 % de commission.
        $response->assertJsonPath('data.0.price.amount', 6_000);
        $response->assertJsonPath('data.0.commission.amount', 600);
        $response->assertJsonPath('data.0.driver_amount.amount', 5_400);
    }

    public function test_a_request_is_visible_only_to_its_author(): void
    {
        $reference = $this->actingAs(User::factory()->create())
            ->postJson('/api/v1/service-requests', $this->payload())
            ->assertCreated()
            ->json('reference');

        $this->actingAs(User::factory()->create())
            ->getJson("/api/v1/service-requests/{$reference}")
            ->assertNotFound();
    }

    /**
     * Sans ce contrôle, n'importe qui pourrait retenir un chauffeur sur la
     * demande d'un autre.
     */
    public function test_an_offer_is_accepted_only_by_the_author_of_its_request(): void
    {
        $passenger = User::factory()->create();
        $driver = $this->driver();

        $reference = $this->actingAs($passenger)
            ->postJson('/api/v1/service-requests', $this->payload())
            ->json('reference');

        $offerId = $this->actingAs($this->userOf($driver))
            ->postJson("/api/v1/service-requests/{$reference}/offers", [
                'price_amount' => 6_000,
                'eta_minutes' => 15,
            ])
            ->json('id');

        $this->actingAs(User::factory()->create())
            ->postJson("/api/v1/offers/{$offerId}/accept")
            ->assertNotFound();
    }

    public function test_a_driver_sees_the_open_requests_of_their_own_city_only(): void
    {
        $this->actingAs(User::factory()->create())
            ->postJson('/api/v1/service-requests', $this->payload())
            ->assertCreated();

        $local = $this->driver();
        $elsewhere = $this->driver(['city_id' => $this->destination->id]);

        $this->actingAs($this->userOf($local))
            ->getJson('/api/v1/driver/requests')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->actingAs($this->userOf($elsewhere))
            ->getJson('/api/v1/driver/requests')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
    }

    public function test_cancelling_drops_the_pending_offers(): void
    {
        $passenger = User::factory()->create();
        $driver = $this->driver();

        $reference = $this->actingAs($passenger)
            ->postJson('/api/v1/service-requests', $this->payload())
            ->json('reference');

        $offerId = $this->actingAs($this->userOf($driver))
            ->postJson("/api/v1/service-requests/{$reference}/offers", [
                'price_amount' => 6_000,
                'eta_minutes' => 15,
            ])
            ->json('id');

        $this->actingAs($passenger)
            ->postJson("/api/v1/service-requests/{$reference}/cancel", ['reason' => 'Trouvé autrement'])
            ->assertOk()
            ->assertJsonPath('status', ServiceRequestStatus::Cancelled->value);

        // Un chauffeur qui patiente sur une demande annulée attend pour rien.
        $this->assertSame(
            OfferStatus::Declined,
            RideOffer::query()->where('id', $offerId)->firstOrFail()->status,
        );
    }

    /**
     * Le balayage rend l'état **lisible**. L'expiration était déjà vraie sans
     * lui, mais un passager doit voir « personne n'est venu » plutôt qu'une
     * demande éternellement en attente.
     */
    public function test_the_sweep_closes_what_time_has_already_closed(): void
    {
        $reference = $this->actingAs(User::factory()->create())
            ->postJson('/api/v1/service-requests', $this->payload())
            ->json('reference');

        ServiceRequest::query()->where('reference', $reference)
            ->update(['expires_at' => CarbonImmutable::now()->subMinute()]);

        $counted = app(ExpireServiceRequests::class)->handle();

        $this->assertSame(1, $counted['requests']);
        $this->assertSame(
            ServiceRequestStatus::Expired,
            ServiceRequest::query()->where('reference', $reference)->firstOrFail()->status,
        );
    }

    /** @return array<string, mixed> */
    private function payload(): array
    {
        return [
            'origin_city_id' => $this->origin->id,
            'origin_landmark' => 'Carrefour Total',
            'destination_city_id' => $this->destination->id,
            'destination_landmark' => 'Gare de Bonaberi',
            'passengers' => 2,
        ];
    }

    /** Ouvre une demande, fait offrir le chauffeur, et retient l'offre. */
    private function ride(DriverProfile $driver): string
    {
        $passenger = User::factory()->create();

        $reference = $this->actingAs($passenger)
            ->postJson('/api/v1/service-requests', $this->payload())
            ->json('reference');

        $offerId = $this->actingAs($this->userOf($driver))
            ->postJson("/api/v1/service-requests/{$reference}/offers", [
                'price_amount' => 6_000,
                'eta_minutes' => 15,
            ])
            ->assertCreated()
            ->json('id');

        $rideReference = $this->actingAs($passenger)
            ->postJson("/api/v1/offers/{$offerId}/accept")
            ->assertCreated()
            ->json('reference');

        $this->assertIsString($rideReference);

        return $rideReference;
    }

    /**
     * L'utilisateur d'un dossier, exige plutot que suppose.
     *
     * La relation est nullable en base ; un dossier sans utilisateur ferait
     * passer ces tests en silence alors qu'ils ne prouveraient plus rien.
     */
    private function userOf(DriverProfile $driver): User
    {
        $user = $driver->user;

        if ($user === null) {
            self::fail('Le dossier de chauffeur doit porter son utilisateur.');
        }

        return $user;
    }

    /** @param array<string, mixed> $attributes */
    private function driver(array $attributes = []): DriverProfile
    {
        $profile = DriverProfile::query()->create([
            'user_id' => User::factory()->create()->id,
            'status' => DriverStatus::Approved,
            'license_number' => 'CM-'.fake()->unique()->numerify('######'),
            'license_expires_at' => CarbonImmutable::now()->addYear(),
            'vehicle_plate' => fake()->unique()->bothify('LT-###-??'),
            'vehicle_type' => VehicleType::Car,
            'vehicle_seats' => 4,
            'city_id' => $this->origin->id,
            ...$attributes,
        ]);

        return $profile->load('user');
    }
}
