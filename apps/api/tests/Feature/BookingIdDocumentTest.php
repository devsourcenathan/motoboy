<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Administration\Support\IdDocumentPolicy;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Fleet\Models\VehicleSeat;
use App\Modules\Identity\Models\User;
use App\Modules\Trips\Models\Trip;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Support\BuildsSearchFixtures;
use Tests\TestCase;

/**
 * La piece d'identite du voyageur principal.
 *
 * **Premier test qui reserve par l'endpoint.** Tous les autres appellent
 * `CreateBooking` directement, si bien que `CreateBookingRequest` — la validation
 * de l'operation centrale du produit — n'etait couverte par rien. Une regle qui
 * s'y ajoute pouvait donc etre fausse sans qu'aucun test ne bronche, ce qui est
 * exactement ce qui est arrive : la suite est restee verte quand j'ai rendu la
 * piece obligatoire.
 */
final class BookingIdDocumentTest extends TestCase
{
    use BuildsSearchFixtures;
    use RefreshDatabase;

    private Trip $trip;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(CountrySeeder::class);
        $this->buildNetwork();

        $this->trip = Trip::query()->where('reference', 'TR-SEATED')->firstOrFail();
        $this->user = User::factory()->create();
    }

    public function test_a_booking_is_refused_without_the_main_passengers_id(): void
    {
        $response = $this->book([]);

        $response->assertStatus(422);
        $response->assertJsonPath('code', 'VALIDATION_FAILED');
        $this->assertSame(0, Booking::query()->count());
    }

    public function test_a_number_is_enough_in_number_mode(): void
    {
        $response = $this->book(['id_document_number' => '110234567']);

        $response->assertStatus(201);

        $passenger = Booking::query()->firstOrFail()->passengers()->firstOrFail();

        $this->assertSame('110234567', $passenger->id_document_number);
        $this->assertNull($passenger->id_document_path);
    }

    /**
     * Le reglage decide de la **forme**, pas seulement de l'exigence : envoyer un
     * numero quand la plateforme demande une photo ne doit pas passer, sans quoi
     * le reglage ne reglerait rien.
     */
    public function test_a_number_does_not_satisfy_image_mode(): void
    {
        app(IdDocumentPolicy::class)->updateMode(
            IdDocumentPolicy::MODE_IMAGE,
            User::factory()->create(),
        );

        $this->book(['id_document_number' => '110234567'])->assertStatus(422);

        $this->book(['id_document_path' => 'id-documents/abc.jpg'])->assertStatus(201);
    }

    /** Le reglage existe pour pouvoir ne rien exiger. */
    public function test_nothing_is_required_once_the_setting_is_off(): void
    {
        app(IdDocumentPolicy::class)->updateRequired(false, User::factory()->create());

        $this->book([])->assertStatus(201);
    }

    /**
     * La piece n'est demandee qu'au **principal** : celle des suivants est ignoree
     * plutot que refusee, pour qu'un client d'une version ulterieure ne voie pas
     * ses reservations rejetees.
     */
    public function test_only_the_main_passenger_carries_a_document(): void
    {
        $seats = VehicleSeat::query()
            ->where('vehicle_id', $this->trip->vehicle_id)
            ->orderBy('id')
            ->limit(2)
            ->pluck('id')
            ->all();

        $this->actingAs($this->user)->postJson('/api/v1/bookings', [
            'trip_reference' => $this->trip->reference,
            'passengers' => [
                ['first_name' => 'Awa', 'last_name' => 'Nkeng', 'seat_id' => $seats[0],
                    'id_document_number' => '110234567'],
                ['first_name' => 'Jean', 'last_name' => 'Kamdem', 'seat_id' => $seats[1],
                    'id_document_number' => '999999999'],
            ],
            'contact_phone' => '+237690000001',
        ], ['Idempotency-Key' => 'two-'.uniqid()])->assertStatus(201);

        $passengers = Booking::query()->firstOrFail()->passengers()->orderBy('id')->get();

        $this->assertSame('110234567', $passengers[0]?->id_document_number);
        $this->assertNull($passengers[1]?->id_document_number);
    }

    /**
     * @param  array<string, string>  $document
     * @return TestResponse<JsonResponse>
     */
    private function book(array $document): TestResponse
    {
        $seat = VehicleSeat::query()
            ->where('vehicle_id', $this->trip->vehicle_id)
            ->orderBy('id')
            ->firstOrFail();

        return $this->actingAs($this->user)->postJson('/api/v1/bookings', [
            'trip_reference' => $this->trip->reference,
            'passengers' => [
                ['first_name' => 'Awa', 'last_name' => 'Nkeng', 'seat_id' => $seat->id, ...$document],
            ],
            'contact_phone' => '+237690000001',
        ], ['Idempotency-Key' => 'book-'.uniqid()]);
    }
}
