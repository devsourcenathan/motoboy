<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Bookings\Actions\CreateBooking;
use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Data\NewPassenger;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Fleet\Models\VehicleSeat;
use App\Modules\Identity\Models\User;
use App\Modules\Payments\Actions\ConfirmPayment;
use App\Modules\Payments\Actions\InitiatePayment;
use App\Modules\Payments\Data\WebhookEvent;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Models\Payment;
use App\Modules\Tickets\Enums\TicketStatus;
use App\Modules\Tickets\Models\Ticket;
use App\Modules\Tickets\Support\QrPayload;
use App\Modules\Trips\Models\Trip;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Support\BuildsSearchFixtures;
use Tests\TestCase;

final class TicketTest extends TestCase
{
    use BuildsSearchFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(CountrySeeder::class);
        $this->buildNetwork();
    }

    public function test_no_ticket_exists_before_payment_is_confirmed(): void
    {
        $booking = $this->book(seats: 2);
        $this->initiate($booking);

        // Avant paiement il n'y a qu'une place tenue : émettre un billet
        // laisserait un passager embarquer sans avoir payé (§19).
        $this->assertSame(0, Ticket::query()->count());
    }

    public function test_one_ticket_is_issued_per_passenger(): void
    {
        $booking = $this->confirmed(seats: 3);

        $tickets = Ticket::query()->where('booking_id', $booking->id)->get();

        // Un billet par passager : c'est ce qui rend possible l'annulation
        // partielle (B5) et donne à chacun un QR qui lui est propre.
        $this->assertCount(3, $tickets);
        $this->assertCount(3, $tickets->pluck('reference')->unique());
        $this->assertSame(
            $booking->passengers->pluck('id')->sort()->values()->all(),
            $tickets->pluck('booking_passenger_id')->sort()->values()->all(),
        );
    }

    public function test_replaying_the_webhook_does_not_reissue_tickets(): void
    {
        $booking = $this->book();
        $payment = $this->initiate($booking);

        $this->confirm($payment);
        $references = Ticket::query()->pluck('reference')->all();

        $this->confirm($payment);

        // Un passager peut déjà avoir son billet à l'écran : une nouvelle
        // référence le rendrait invalide à l'embarquement.
        $this->assertSame($references, Ticket::query()->pluck('reference')->all());
        $this->assertSame(1, Ticket::query()->count());
    }

    public function test_the_qr_carries_the_reference_and_a_verifiable_signature(): void
    {
        $ticket = $this->confirmed()->passengers->first()?->ticket;
        $this->assertNotNull($ticket);

        $payload = QrPayload::encode($ticket->reference);

        $this->assertStringStartsWith('MTB1:', $payload);
        $this->assertSame($ticket->reference, QrPayload::reference($payload));
        $this->assertTrue(QrPayload::verify($payload));
    }

    public function test_a_tampered_qr_is_rejected(): void
    {
        $ticket = $this->confirmed()->passengers->first()?->ticket;
        $this->assertNotNull($ticket);

        // Référence remplacée, signature conservée : la forge la plus évidente.
        $forged = 'MTB1:TKT-ZZZZZZ:'.explode(':', QrPayload::encode($ticket->reference))[2];

        $this->assertFalse(QrPayload::verify($forged));
        $this->assertFalse(QrPayload::verify('MTB1:'.$ticket->reference.':0000000000000000'));
    }

    public function test_an_unknown_payload_format_is_refused_not_guessed(): void
    {
        // Le préfixe de version existe pour que le jour où le format changera,
        // on distingue un ancien billet d'une charge corrompue.
        $this->assertNull(QrPayload::reference('MTB2:TKT-ABCDEF:0000'));
        $this->assertNull(QrPayload::reference('TKT-ABCDEF'));
        $this->assertFalse(QrPayload::verify('nimporte quoi'));
    }

    public function test_a_passenger_reads_their_ticket_but_not_another_one(): void
    {
        $booking = $this->confirmed();
        $ticket = $booking->passengers->first()?->ticket;
        $this->assertNotNull($ticket);

        $owner = User::query()->findOrFail($booking->user_id);
        $stranger = User::factory()->create();

        $this->actingAs($owner)
            ->getJson("/api/v1/tickets/{$ticket->reference}")
            ->assertOk()
            ->assertJsonPath('reference', $ticket->reference)
            ->assertJsonPath('status', TicketStatus::Valid->value)
            // Le contenu à encoder, pas une image : le client regénère le QR
            // localement pour que le billet reste lisible sans réseau (I5).
            ->assertJsonPath('qr_payload', QrPayload::encode($ticket->reference));

        $this->actingAs($stranger)
            ->getJson("/api/v1/tickets/{$ticket->reference}")
            ->assertStatus(403)
            ->assertJsonPath('code', 'FORBIDDEN');
    }

    private function book(int $seats = 1): Booking
    {
        $trip = Trip::query()->where('reference', 'TR-SEATED')->firstOrFail();

        $chosen = VehicleSeat::query()
            ->where('vehicle_id', $trip->vehicle_id)
            ->orderBy('id')
            ->limit($seats)
            ->get();

        $passengers = [];

        foreach ($chosen as $index => $seat) {
            $passengers[] = new NewPassenger('Awa', 'Nkeng '.$index, null, $seat->id);
        }

        return (new CreateBooking)->handle(new NewBooking(
            tripReference: $trip->reference,
            passengers: $passengers,
            idempotencyKey: 'booking-'.bin2hex(random_bytes(4)),
            userId: User::factory()->create()->id,
        ));
    }

    private function confirmed(int $seats = 1): Booking
    {
        $booking = $this->book($seats);
        $this->confirm($this->initiate($booking));

        return $booking->refresh()->load('passengers.ticket', 'passengers.seat');
    }

    private function initiate(Booking $booking): Payment
    {
        return app(InitiatePayment::class)->handle(
            booking: $booking,
            method: PaymentMethod::MobileMoney,
            operator: 'MTN',
            payerPhone: '+237690000001',
            idempotencyKey: 'pay-'.bin2hex(random_bytes(4)),
        );
    }

    private function confirm(Payment $payment): void
    {
        app(ConfirmPayment::class)->handle(new WebhookEvent(
            eventId: 'evt-'.bin2hex(random_bytes(4)),
            providerReference: (string) $payment->refresh()->provider_reference,
            status: PaymentStatus::Succeeded,
        ));
    }
}
