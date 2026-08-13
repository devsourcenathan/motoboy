<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Bookings\Actions\CreateBooking;
use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Data\NewPassenger;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Fleet\Models\VehicleSeat;
use App\Modules\Identity\Enums\Role as RoleEnum;
use App\Modules\Identity\Models\Role;
use App\Modules\Identity\Models\User;
use App\Modules\Payments\Actions\ConfirmPayment;
use App\Modules\Payments\Actions\InitiatePayment;
use App\Modules\Payments\Data\WebhookEvent;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Tickets\Enums\TicketStatus;
use App\Modules\Tickets\Models\Ticket;
use App\Modules\Tickets\Models\TicketValidation;
use App\Modules\Trips\Models\Trip;
use Database\Seeders\CountrySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Symfony\Component\HttpFoundation\Response;
use Tests\Feature\Support\BuildsSearchFixtures;
use Tests\TestCase;

final class BoardingTest extends TestCase
{
    use BuildsSearchFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(CountrySeeder::class);
        $this->seed(RoleAndPermissionSeeder::class);
        $this->buildNetwork();
    }

    public function test_the_list_carries_only_confirmed_bookings(): void
    {
        $trip = $this->trip();
        $confirmed = $this->confirmed($trip);
        $this->book($trip, seats: 1, offset: 1);

        $response = $this->actingAs($this->agentOf($trip))
            ->getJson("/api/v1/agency/trips/{$trip->reference}/boarding-list")
            ->assertOk();

        // Une place tenue n'est pas une place payée : la faire figurer sur la
        // liste laisserait embarquer quelqu'un qui n'a pas payé.
        $references = array_column($response->json('passengers'), 'booking_reference');

        $this->assertSame([$confirmed->reference], array_unique($references));
        $this->assertNotNull($response->json('generated_at'));
    }

    public function test_an_agent_of_another_agency_is_refused(): void
    {
        $trip = $this->trip();
        $other = Trip::query()->where('reference', 'TR-CAPACITY')->firstOrFail();

        // Sans portée par agence, un agent validerait les billets de toutes les
        // agences de la plateforme (B3).
        $this->actingAs($this->agentOf($other))
            ->getJson("/api/v1/agency/trips/{$trip->reference}/boarding-list")
            ->assertStatus(403)
            ->assertJsonPath('code', 'FORBIDDEN');
    }

    public function test_a_passenger_cannot_reach_the_boarding_list(): void
    {
        $trip = $this->trip();

        $this->actingAs(User::factory()->create())
            ->getJson("/api/v1/agency/trips/{$trip->reference}/boarding-list")
            ->assertStatus(403);
    }

    public function test_a_batch_reports_each_item_on_its_own(): void
    {
        $trip = $this->trip();
        $booking = $this->confirmed($trip);
        $ticket = $this->ticketOf($booking);
        $elsewhere = $this->ticketOf($this->confirmed(
            Trip::query()->where('reference', 'TR-CAPACITY')->firstOrFail(),
        ));

        $results = $this->sync($trip, [
            $this->item('q-1', $ticket->reference),
            $this->item('q-2', 'TKT-INCONNU'),
            $this->item('q-3', $elsewhere->reference),
        ])->assertOk()->json('results');

        // Jamais du tout-ou-rien : un rejet ne doit pas emporter les autres.
        $byClient = array_column($results, null, 'client_id');

        $this->assertSame('ACCEPTED', $byClient['q-1']['status']);
        $this->assertSame('REJECTED', $byClient['q-2']['status']);
        $this->assertSame('TICKET_NOT_FOUND', $byClient['q-2']['code']);
        $this->assertSame('REJECTED', $byClient['q-3']['status']);
        // Le cas le plus fréquent au portillon : erreur d'heure ou de car.
        $this->assertSame('TICKET_WRONG_TRIP', $byClient['q-3']['code']);
    }

    public function test_a_second_agent_scanning_the_same_ticket_is_flagged_not_blocked(): void
    {
        $trip = $this->trip();
        $ticket = $this->ticketOf($this->confirmed($trip));

        $this->sync($trip, [$this->item('q-1', $ticket->reference)], device: 'tel-A');

        $results = $this->sync($trip, [$this->item('q-9', $ticket->reference)], device: 'tel-B')
            ->assertOk()->json('results');

        $this->assertSame('DUPLICATE', $results[0]['status']);
        $this->assertSame('TICKET_ALREADY_VALIDATED', $results[0]['code']);
        $this->assertNotNull($results[0]['first_validated_at']);

        // Le doublon est **enregistré**, pas rejeté : le refuser ferait perdre
        // l'information qui permet de diagnostiquer (B3).
        $this->assertSame(2, TicketValidation::query()->where('ticket_id', $ticket->id)->count());
        $this->assertSame(1, TicketValidation::query()->where('is_duplicate', true)->count());
    }

    public function test_the_same_device_resyncing_is_not_a_duplicate(): void
    {
        $trip = $this->trip();
        $ticket = $this->ticketOf($this->confirmed($trip));

        $this->sync($trip, [$this->item('q-1', $ticket->reference)], device: 'tel-A');

        // Réponse perdue, le client réémet sa file : c'est le même geste, pas
        // deux agents. Le compter comme anomalie transformerait chaque coupure
        // réseau en faux positif.
        $results = $this->sync($trip, [$this->item('q-1', $ticket->reference)], device: 'tel-A')
            ->assertOk()->json('results');

        $this->assertSame('ACCEPTED', $results[0]['status']);
        $this->assertSame(1, TicketValidation::query()->where('ticket_id', $ticket->id)->count());
    }

    public function test_a_fully_boarded_group_closes_its_booking(): void
    {
        $trip = $this->trip();
        $booking = $this->confirmed($trip, seats: 2);
        $tickets = Ticket::query()->where('booking_id', $booking->id)->get();
        $this->assertCount(2, $tickets);

        $first = $tickets->firstOrFail();
        $second = $tickets->skip(1)->firstOrFail();

        $this->sync($trip, [$this->item('q-1', $first->reference)]);

        // Un voyageur sur deux monté, ce n'est pas un voyage effectué : marquer
        // la réservation masquerait le passager resté à quai.
        $this->assertSame(BookingStatus::Confirmed, $booking->refresh()->status);

        $this->sync($trip, [$this->item('q-2', $second->reference)]);

        $this->assertSame(BookingStatus::Used, $booking->refresh()->status);
    }

    public function test_manual_lookup_answers_the_five_cases_distinctly(): void
    {
        $trip = $this->trip();
        $ticket = $this->ticketOf($this->confirmed($trip));
        $agent = $this->agentOf($trip);

        // Un simple « invalide » est inexploitable : l'agent doit savoir
        // pourquoi (B3).
        $this->actingAs($agent)
            ->postJson('/api/v1/agency/tickets/lookup', [
                'reference' => $ticket->reference,
                'trip_reference' => $trip->reference,
            ])
            ->assertOk()
            ->assertJsonPath('ticket_reference', $ticket->reference)
            ->assertJsonPath('group_size', 1);

        $this->actingAs($agent)
            ->postJson('/api/v1/agency/tickets/lookup', [
                'reference' => 'TKT-INCONNU',
                'trip_reference' => $trip->reference,
            ])
            ->assertStatus(404)
            ->assertJsonPath('code', 'TICKET_NOT_FOUND');

        $this->sync($trip, [$this->item('q-1', $ticket->reference)]);

        $this->actingAs($agent)
            ->postJson('/api/v1/agency/tickets/lookup', [
                'reference' => $ticket->reference,
                'trip_reference' => $trip->reference,
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'TICKET_ALREADY_VALIDATED');
    }

    public function test_a_validated_ticket_becomes_used(): void
    {
        $trip = $this->trip();
        $ticket = $this->ticketOf($this->confirmed($trip));

        $this->sync($trip, [$this->item('q-1', $ticket->reference)]);

        $this->assertSame(TicketStatus::Used, $ticket->refresh()->status);
    }

    // ── fixtures ──

    private function trip(): Trip
    {
        return Trip::query()->where('reference', 'TR-SEATED')->firstOrFail();
    }

    private function agentOf(Trip $trip): User
    {
        $user = User::factory()->create();
        $roleId = Role::query()->where('name', RoleEnum::Agent->value)->value('id');

        DB::table('role_user')->insert([
            'user_id' => $user->id,
            'role_id' => $roleId,
            'agency_id' => $trip->agency_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $user;
    }

    private function book(Trip $trip, int $seats = 1, int $offset = 0): Booking
    {
        $chosen = VehicleSeat::query()
            ->where('vehicle_id', $trip->vehicle_id)
            ->orderBy('id')
            ->skip($offset)
            ->limit($seats)
            ->get();

        $passengers = [];

        foreach ($chosen as $index => $seat) {
            $passengers[] = new NewPassenger('Awa', 'Nkeng '.$index, null, $seat->id);
        }

        if ($passengers === []) {
            $passengers[] = new NewPassenger('Awa', 'Nkeng', null, null);
        }

        return (new CreateBooking)->handle(new NewBooking(
            tripReference: $trip->reference,
            passengers: $passengers,
            idempotencyKey: 'bk-'.bin2hex(random_bytes(5)),
            userId: User::factory()->create()->id,
        ));
    }

    private function confirmed(Trip $trip, int $seats = 1): Booking
    {
        $booking = $this->book($trip, $seats);

        $payment = app(InitiatePayment::class)->handle(
            booking: $booking,
            method: PaymentMethod::MobileMoney,
            operator: 'MTN',
            payerPhone: '+237690000001',
            idempotencyKey: 'pay-'.bin2hex(random_bytes(5)),
        );

        app(ConfirmPayment::class)->handle(new WebhookEvent(
            eventId: 'evt-'.bin2hex(random_bytes(5)),
            providerReference: (string) $payment->refresh()->provider_reference,
            status: PaymentStatus::Succeeded,
        ));

        return $booking->refresh();
    }

    private function ticketOf(Booking $booking): Ticket
    {
        return Ticket::query()->where('booking_id', $booking->id)->firstOrFail();
    }

    /** @return array<string, string> */
    private function item(string $clientId, string $reference): array
    {
        return [
            'client_id' => $clientId,
            'ticket_reference' => $reference,
            'validated_at' => now()->toIso8601String(),
            'method' => 'SCAN',
        ];
    }

    /**
     * @param  list<array<string, string>>  $items
     * @return TestResponse<Response>
     */
    private function sync(Trip $trip, array $items, string $device = 'tel-defaut'): TestResponse
    {
        return $this->actingAs($this->agentOf($trip))
            ->postJson("/api/v1/agency/trips/{$trip->reference}/validations", [
                'device_id' => $device,
                'validations' => $items,
            ]);
    }
}
