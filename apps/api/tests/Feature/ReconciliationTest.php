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
use App\Modules\Payments\Actions\ReconcilePayments;
use App\Modules\Payments\Data\GatewayTransaction;
use App\Modules\Payments\Data\WebhookEvent;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Gateways\FakePaymentGateway;
use App\Modules\Payments\Models\Payment;
use App\Modules\Trips\Models\Trip;
use Carbon\CarbonImmutable;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Support\BuildsSearchFixtures;
use Tests\TestCase;

/**
 * Réconciliation quotidienne (B4, I7).
 *
 * **Sans ce contrôle, « le passager a payé mais n'a pas de billet » ne se
 * découvre que par réclamation.** Un webhook perdu ne laisse aucune trace
 * locale : le paiement reste en attente chez nous et abouti chez le prestataire.
 */
final class ReconciliationTest extends TestCase
{
    use BuildsSearchFixtures;
    use RefreshDatabase;

    private Trip $trip;

    protected function setUp(): void
    {
        parent::setUp();

        FakePaymentGateway::reset();
        $this->seed(CountrySeeder::class);
        $this->buildNetwork();

        $this->trip = Trip::query()->where('reference', 'TR-SEATED')->firstOrFail();
    }

    public function test_nothing_is_reported_when_everything_agrees(): void
    {
        $this->paidBooking();

        $report = app(ReconcilePayments::class)->handle();

        $this->assertSame(1, $report['checked']);
        $this->assertSame([], $report['missing_locally']);
        $this->assertSame([], $report['missing_remotely']);
        $this->assertSame([], $report['mismatched']);
    }

    /**
     * Le cas que la réconciliation existe pour attraper : le passager a payé et
     * n'a pas de billet.
     */
    public function test_a_payment_the_provider_knows_and_we_do_not_is_reported(): void
    {
        FakePaymentGateway::willReport([
            new GatewayTransaction(
                providerReference: 'fake-jamais-vu',
                amount: 6500,
                currency: 'XAF',
                status: PaymentStatus::Succeeded,
                occurredAt: CarbonImmutable::now(),
            ),
        ]);

        $report = app(ReconcilePayments::class)->handle();

        $this->assertSame(['fake-jamais-vu'], $report['missing_locally']);
    }

    /**
     * L'inverse, et le plus grave : une agence créditée pour de l'argent que le
     * prestataire n'a jamais encaissé.
     */
    public function test_a_payment_we_hold_and_the_provider_does_not_is_reported(): void
    {
        $booking = $this->paidBooking();
        $payment = Payment::query()->where('booking_id', $booking->id)->firstOrFail();

        FakePaymentGateway::willReport([]);

        $report = app(ReconcilePayments::class)->handle();

        $this->assertSame([$payment->reference], $report['missing_remotely']);
    }

    public function test_a_differing_amount_is_reported(): void
    {
        $booking = $this->paidBooking();
        $payment = Payment::query()->where('booking_id', $booking->id)->firstOrFail();

        FakePaymentGateway::willReport([
            new GatewayTransaction(
                providerReference: (string) $payment->provider_reference,
                amount: $payment->amount - 500,
                currency: 'XAF',
                status: PaymentStatus::Succeeded,
                occurredAt: CarbonImmutable::now(),
            ),
        ]);

        $report = app(ReconcilePayments::class)->handle();

        $this->assertSame([$payment->reference], $report['mismatched']);
    }

    public function test_reconciliation_never_corrects_anything_by_itself(): void
    {
        $booking = $this->book();

        app(InitiatePayment::class)->handle(
            booking: $booking,
            method: PaymentMethod::MobileMoney,
            operator: 'MTN',
            payerPhone: '+237690000001',
            idempotencyKey: 'pay-'.bin2hex(random_bytes(4)),
        );

        $payment = Payment::query()->where('booking_id', $booking->id)->firstOrFail();

        // Le prestataire dit « abouti », nous disons « en cours ».
        FakePaymentGateway::willReport([
            new GatewayTransaction(
                providerReference: (string) $payment->provider_reference,
                amount: $payment->amount,
                currency: 'XAF',
                status: PaymentStatus::Succeeded,
                occurredAt: CarbonImmutable::now(),
            ),
        ]);

        $report = app(ReconcilePayments::class)->handle();

        $this->assertSame([$payment->reference], $report['mismatched']);

        // Confirmer automatiquement émettrait un billet sans avoir jamais vu le
        // webhook, et un relevé erroné se propagerait en billets. La
        // réconciliation signale ; un humain tranche.
        $this->assertSame(PaymentStatus::Processing, $payment->refresh()->status);
        $this->assertSame(0, $booking->refresh()->tickets()->count());
    }

    private function paidBooking(): Booking
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
}
