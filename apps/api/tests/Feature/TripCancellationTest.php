<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Bookings\Actions\CreateBooking;
use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Data\NewPassenger;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Fleet\Models\VehicleSeat;
use App\Modules\Identity\Enums\Role as RoleEnum;
use App\Modules\Identity\Models\Role;
use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Jobs\NotifyTripCancelled;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Payments\Actions\ConfirmPayment;
use App\Modules\Payments\Actions\InitiatePayment;
use App\Modules\Payments\Data\WebhookEvent;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Enums\RefundReason;
use App\Modules\Payments\Gateways\FakePaymentGateway;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Tickets\Enums\TicketStatus;
use App\Modules\Trips\Models\Trip;
use Carbon\CarbonImmutable;
use Database\Seeders\CountrySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Support\BuildsSearchFixtures;
use Tests\TestCase;

/**
 * Annulation d'un départ par l'agence (B5-B).
 *
 * Le cas le plus fréquent sur le terrain — panne, effectif insuffisant, route
 * coupée — et le plus lourd : plusieurs dizaines de passagers déjà payés.
 */
final class TripCancellationTest extends TestCase
{
    use BuildsSearchFixtures;
    use RefreshDatabase;

    private Trip $trip;

    private Agency $agency;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        FakePaymentGateway::reset();
        $this->seed(CountrySeeder::class);
        $this->seed(RoleAndPermissionSeeder::class);
        $this->buildNetwork();

        $this->trip = Trip::query()->where('reference', 'TR-SEATED')->firstOrFail();
        $this->trip->update(['departure_at' => CarbonImmutable::now()->addDay()]);

        $this->agency = $this->trip->agency()->firstOrFail();
        $this->manager = $this->managerOf($this->agency);
    }

    public function test_every_passenger_is_refunded_in_full_and_without_fee(): void
    {
        $first = $this->paidBooking();
        $second = $this->paidBooking();

        $response = $this->cancel()->assertOk();

        $this->assertSame(2, $response->json('bookings_cancelled'));
        $this->assertSame(2, $response->json('passengers_cancelled'));
        $this->assertSame(
            $first->total_amount + $second->total_amount,
            $response->json('refunded.amount'),
        );

        foreach ([$first, $second] as $booking) {
            $refund = Refund::query()->where('booking_id', $booking->id)->firstOrFail();

            // Intégral et sans frais : le passager n'y est pour rien.
            $this->assertSame($booking->total_amount, $refund->amount);
            $this->assertSame(0, $refund->fee_amount);
            $this->assertSame(RefundReason::AgencyTripCancelled, $refund->reason);

            $this->assertSame(BookingStatus::CancelledByAgency, $booking->refresh()->status);
            $this->assertSame(0, $booking->activePassengers()->count());
            $this->assertSame(0, $booking->tickets()->where('status', TicketStatus::Valid)->count());
        }
    }

    public function test_the_seats_go_back_and_the_departure_carries_nobody(): void
    {
        $this->paidBooking();

        $this->cancel()->assertOk();

        $this->trip->refresh();

        $this->assertSame('CANCELLED', $this->trip->status);
        $this->assertNotNull($this->trip->cancelled_at);
        $this->assertSame('BREAKDOWN', $this->trip->cancellation_reason);
        $this->assertSame(0, $this->trip->seats_taken);
        $this->assertSame(0, DB::table('booking_passengers')->where('holds_seat', true)->count());
    }

    /**
     * Le taux d'annulation ne compte que les départs portant des réservations
     * confirmées : supprimer un départ généré non assuré relève de la gestion de
     * planning, pas de l'incident (I1).
     */
    public function test_an_empty_departure_does_not_count_against_the_agency(): void
    {
        $this->cancel()->assertOk();

        $this->assertFalse((bool) $this->trip->refresh()->had_confirmed_bookings_at_cancellation);
    }

    public function test_a_departure_carrying_passengers_does_count(): void
    {
        $this->paidBooking();

        $this->cancel()->assertOk();

        $this->assertTrue((bool) $this->trip->refresh()->had_confirmed_bookings_at_cancellation);
    }

    /**
     * Le compte courant absorbe l'opération sans créance à récupérer : le délai
     * d'éligibilité de 24 h après départ garantit que l'annulation intervient
     * avant que les fonds ne soient sortis (B4).
     */
    public function test_the_agency_gets_its_commission_back_and_keeps_nothing(): void
    {
        $booking = $this->paidBooking(fee: 100);

        $this->cancel()->assertOk();

        $entries = AgencyLedgerEntry::query()->where('agency_id', $booking->agency_id)->get();

        $this->assertNotNull($entries->firstWhere('type', 'COMMISSION_REVERSAL_CREDIT'));

        // Aucun frais retenu, donc rien à récupérer : MOTOBOY absorbe ses frais
        // d'encaissement. L'agence ne garde rien non plus — le voyage n'a pas eu
        // lieu.
        $this->assertNull($entries->firstWhere('type', 'AGGREGATOR_FEE_DEBIT'));
        $this->assertSame(0, (int) $entries->sum('amount'));
    }

    public function test_a_pending_booking_is_cancelled_without_a_refund(): void
    {
        $booking = $this->book();

        $this->cancel()->assertOk();

        $this->assertSame(BookingStatus::CancelledByAgency, $booking->refresh()->status);
        $this->assertSame(0, Refund::query()->count());
    }

    public function test_the_notification_leaves_the_request(): void
    {
        Queue::fake();

        $this->paidBooking();
        $this->cancel()->assertOk();

        // Notifier trente passagers en synchrone ferait expirer la requête au
        // pire moment possible — celui où l'agence a le plus besoin que
        // l'annulation aboutisse.
        Queue::assertPushed(NotifyTripCancelled::class);
    }

    public function test_the_passengers_are_told_by_sms(): void
    {
        $booking = $this->paidBooking();

        $this->cancel()->assertOk();

        // C'est le cas où le coût du SMS est justifié sans discussion : un
        // passager qui se déplace vers une gare pour un car annulé est perdu
        // définitivement (I8).
        $notification = Notification::query()->where('type', 'TRIP_CANCELLED')->firstOrFail();

        $this->assertSame('SENT', $notification->status);
        $this->assertSame($booking->reference, $notification->payload['booking_reference'] ?? null);
    }

    public function test_a_reason_is_required(): void
    {
        $this->actingAs($this->manager)
            ->postJson("/api/v1/agency/trips/{$this->trip->reference}/cancel", [])
            ->assertStatus(422);
    }

    public function test_a_second_cancellation_is_refused(): void
    {
        $this->cancel()->assertOk();

        $this->cancel()
            ->assertStatus(409)
            ->assertJsonPath('code', 'TRIP_CANCELLED');
    }

    public function test_an_agency_cancels_nothing_on_another_agency_departure(): void
    {
        $other = Trip::query()->where('reference', 'TR-CAPACITY')->firstOrFail();

        $this->actingAs($this->manager)
            ->postJson("/api/v1/agency/trips/{$other->reference}/cancel", ['reason' => 'BREAKDOWN'])
            ->assertStatus(404)
            ->assertJsonPath('code', 'NOT_FOUND');
    }

    /** @return TestResponse<JsonResponse> */
    private function cancel(string $reason = 'BREAKDOWN'): TestResponse
    {
        return $this->actingAs($this->manager)
            ->postJson("/api/v1/agency/trips/{$this->trip->reference}/cancel", [
                'reason' => $reason,
                'note' => 'Pont coupe a Melong',
            ]);
    }

    private function paidBooking(int $fee = 0): Booking
    {
        $booking = $this->book();

        $payment = app(InitiatePayment::class)->handle(
            booking: $booking,
            method: PaymentMethod::MobileMoney,
            operator: 'MTN',
            payerPhone: '+237690000001',
            idempotencyKey: 'pay-'.bin2hex(random_bytes(4)),
        );

        app(ConfirmPayment::class)->handle(new WebhookEvent(
            eventId: 'evt-'.bin2hex(random_bytes(4)),
            providerReference: (string) $payment->refresh()->provider_reference,
            status: PaymentStatus::Succeeded,
            feeAmount: $fee,
        ));

        return $booking->refresh();
    }

    private function book(): Booking
    {
        $taken = DB::table('booking_passengers')->whereNotNull('seat_id')->pluck('seat_id')->all();

        $seat = VehicleSeat::query()
            ->where('vehicle_id', $this->trip->vehicle_id)
            ->whereNotIn('id', $taken)
            ->orderBy('id')
            ->firstOrFail();

        return app(CreateBooking::class)->handle(new NewBooking(
            tripReference: $this->trip->reference,
            passengers: [new NewPassenger('Awa', 'Nkeng', null, $seat->id)],
            idempotencyKey: 'booking-'.bin2hex(random_bytes(4)),
            userId: User::factory()->create()->id,
        ));
    }

    private function managerOf(Agency $agency): User
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
