<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Identity\Models\User;
use App\Modules\Places\Models\City;
use App\Modules\Rides\Actions\AcceptOffer;
use App\Modules\Rides\Actions\MakeOffer;
use App\Modules\Rides\Actions\OpenServiceRequest;
use App\Modules\Rides\Enums\DriverStatus;
use App\Modules\Rides\Enums\OfferStatus;
use App\Modules\Rides\Enums\ServiceRequestStatus;
use App\Modules\Rides\Models\DriverProfile;
use App\Modules\Rides\Models\Ride;
use App\Modules\Rides\Models\ServiceRequest;
use App\Support\Http\ApiException;
use Carbon\CarbonImmutable;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Demande, offres, course (E1).
 *
 * L'acceptation d'une offre est **l'opération concurrente du module**,
 * l'équivalent de la prise de places (B2). Ce sont ses garde-fous qui sont
 * testés ici en priorité : les autres règles se corrigent, une double promesse
 * de véhicule se paie sur le terrain.
 */
final class ServiceRequestTest extends TestCase
{
    use RefreshDatabase;

    private City $bafang;

    private City $douala;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(CountrySeeder::class);
        $this->seed(CitySeeder::class);

        $cities = City::query()->orderBy('id')->limit(2)->get();
        $this->bafang = $cities->firstOrFail();
        $this->douala = $cities->last() ?? $this->bafang;
    }

    public function test_a_request_opens_and_waits(): void
    {
        $request = $this->open();

        $this->assertSame(ServiceRequestStatus::Open, $request->status);
        $this->assertTrue($request->isOpenForOffers());
        $this->assertTrue($request->expires_at->isFuture());
    }

    /**
     * Deux demandes simultanées feraient répondre des chauffeurs à un besoin qui
     * n'existe qu'une fois, et le second à arriver aurait roulé pour rien.
     */
    public function test_a_passenger_holds_one_open_request_at_a_time(): void
    {
        $passenger = User::factory()->create();
        $this->open($passenger);

        $this->expectException(ApiException::class);

        $this->open($passenger);
    }

    public function test_an_offer_moves_the_request_to_offered(): void
    {
        $request = $this->open();

        app(MakeOffer::class)->handle($request, $this->driver(), 6_000, 15);

        $this->assertSame(ServiceRequestStatus::Offered, $request->refresh()->status);
    }

    /**
     * Sans agence pour répondre d'un incident, la validation du dossier est la
     * seule barrière — et elle se vérifie à chaque offre, pas une fois pour
     * toutes.
     */
    public function test_an_unapproved_driver_offers_nothing(): void
    {
        $request = $this->open();
        $driver = $this->driver(['status' => DriverStatus::Pending]);

        $this->expectException(ApiException::class);

        app(MakeOffer::class)->handle($request, $driver, 6_000, 15);
    }

    /**
     * Portée de « sa ville » : égalité stricte avec la ville de départ. Faute de
     * coordonnées, la proximité ne se calcule pas.
     */
    public function test_a_driver_of_another_city_offers_nothing(): void
    {
        $request = $this->open();
        $driver = $this->driver(['city_id' => $this->douala->id]);

        $this->expectException(ApiException::class);

        app(MakeOffer::class)->handle($request, $driver, 6_000, 15);
    }

    public function test_accepting_an_offer_drops_the_others_and_creates_the_ride(): void
    {
        $request = $this->open();

        $chosen = app(MakeOffer::class)->handle($request, $this->driver(), 6_000, 15);
        $other = app(MakeOffer::class)->handle($request, $this->driver(), 8_000, 10);

        $ride = app(AcceptOffer::class)->handle($chosen);

        $this->assertSame($chosen->id, $ride->ride_offer_id);
        // Le prix est recopié : l'offre peut être nettoyée, la course reste
        // lisible telle qu'elle a été conclue.
        $this->assertSame(6_000, $ride->price_amount);

        $this->assertSame(OfferStatus::Accepted, $chosen->refresh()->status);
        // Le chauffeur écarté doit le savoir plutôt que d'attendre.
        $this->assertSame(OfferStatus::Declined, $other->refresh()->status);
        $this->assertSame(ServiceRequestStatus::Matched, $request->refresh()->status);
    }

    /**
     * Le garde-fou qui compte : **une seule offre acceptée par demande**, portée
     * par un index unique partiel. Deux acceptations concurrentes promettraient
     * deux véhicules pour un seul trajet.
     */
    public function test_a_second_offer_cannot_be_accepted_on_the_same_request(): void
    {
        $request = $this->open();

        $first = app(MakeOffer::class)->handle($request, $this->driver(), 6_000, 15);
        $second = app(MakeOffer::class)->handle($request, $this->driver(), 7_000, 12);

        app(AcceptOffer::class)->handle($first);

        // La demande n'est plus en attente : l'offre suivante est refusée avant
        // même d'atteindre l'index.
        $this->expectException(ApiException::class);

        app(AcceptOffer::class)->handle($second->refresh());
    }

    /**
     * Second garde-fou : **une seule course active par chauffeur**. Un chauffeur
     * ne peut pas être à deux endroits, et accepter une seconde course
     * promettrait un véhicule qui n'arrivera pas.
     */
    public function test_a_driver_cannot_hold_two_active_rides(): void
    {
        $driver = $this->driver();

        $first = $this->open();
        app(AcceptOffer::class)->handle(
            app(MakeOffer::class)->handle($first, $driver, 6_000, 15),
        );

        // Une autre demande, un autre passager, le même chauffeur : l'offre est
        // refusée dès le dépôt puisqu'il est déjà en course.
        $second = $this->open(User::factory()->create());

        $this->expectException(ApiException::class);

        app(MakeOffer::class)->handle($second, $driver, 5_000, 20);
    }

    /**
     * L'expiration est une question de temps, pas d'écriture : s'appuyer sur le
     * seul statut laisserait une fenêtre où l'on répond à une demande morte.
     */
    public function test_an_expired_request_takes_no_offer_even_before_its_status_catches_up(): void
    {
        $request = $this->open();
        $request->update(['expires_at' => CarbonImmutable::now()->subMinute()]);

        $this->assertSame(ServiceRequestStatus::Open, $request->refresh()->status);
        $this->assertFalse($request->isOpenForOffers());

        $this->expectException(ApiException::class);

        app(MakeOffer::class)->handle($request, $this->driver(), 6_000, 15);
    }

    public function test_an_expired_offer_cannot_be_accepted(): void
    {
        $request = $this->open();
        $offer = app(MakeOffer::class)->handle($request, $this->driver(), 6_000, 15);

        $offer->update(['expires_at' => CarbonImmutable::now()->subMinute()]);

        $this->expectException(ApiException::class);

        app(AcceptOffer::class)->handle($offer->refresh());
    }

    public function test_the_ride_carries_a_dictatable_reference(): void
    {
        $request = $this->open();
        $ride = app(AcceptOffer::class)->handle(
            app(MakeOffer::class)->handle($request, $this->driver(), 6_000, 15),
        );

        // Sans I, O, 0 ni 1 : la référence se dicte au téléphone.
        $this->assertMatchesRegularExpression('/^RID-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/', $ride->reference);
        $this->assertSame(1, Ride::query()->count());
    }

    private function open(?User $passenger = null): ServiceRequest
    {
        return app(OpenServiceRequest::class)->handle($passenger ?? User::factory()->create(), [
            'origin_city_id' => $this->bafang->id,
            'origin_landmark' => 'Carrefour Total',
            'destination_city_id' => $this->douala->id,
            'destination_landmark' => 'Gare de Bonaberi',
            'passengers' => 2,
        ]);
    }

    /** @param array<string, mixed> $attributes */
    private function driver(array $attributes = []): DriverProfile
    {
        return DriverProfile::query()->create([
            'user_id' => User::factory()->create()->id,
            'status' => DriverStatus::Approved,
            'license_number' => 'CM-'.fake()->unique()->numerify('######'),
            'license_expires_at' => CarbonImmutable::now()->addYear(),
            'vehicle_plate' => fake()->unique()->bothify('LT-###-??'),
            'vehicle_type' => VehicleType::Car,
            'vehicle_seats' => 4,
            'city_id' => $this->bafang->id,
            ...$attributes,
        ]);
    }
}
