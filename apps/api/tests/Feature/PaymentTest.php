<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Bookings\Actions\CreateBooking;
use App\Modules\Bookings\Actions\ReleaseExpiredHolds;
use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Data\NewPassenger;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Fleet\Models\VehicleSeat;
use App\Modules\Identity\Models\User;
use App\Modules\Payments\Actions\ConfirmPayment;
use App\Modules\Payments\Actions\InitiatePayment;
use App\Modules\Payments\Data\WebhookEvent;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Enums\RefundReason;
use App\Modules\Payments\Gateways\FakePaymentGateway;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Commission;
use App\Modules\Trips\Models\Trip;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Support\BuildsSearchFixtures;
use Tests\TestCase;

final class PaymentTest extends TestCase
{
    use BuildsSearchFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        FakePaymentGateway::reset();
        $this->seed(CountrySeeder::class);
        $this->buildNetwork();
    }

    public function test_a_charge_is_never_settled_synchronously(): void
    {
        $payment = $this->initiate($this->book());

        // En Mobile Money, le passager doit encore saisir son code sur son
        // téléphone : un pilote renvoyant un succès immédiat laisserait écrire
        // du code incapable de gérer le vrai flux (B2).
        $this->assertSame(PaymentStatus::Processing, $payment->status);
        $this->assertNotNull($payment->provider_reference);
        $this->assertNull($payment->paid_at);
    }

    public function test_a_failed_attempt_keeps_the_seats_held(): void
    {
        $booking = $this->book();
        $payment = $this->initiate($booking);

        $this->confirm($payment, PaymentStatus::Failed, 'Solde insuffisant');

        $booking->refresh();

        // Avec Mobile Money l'échec est banal, et réessayer est le cas nominal :
        // libérer la place au premier échec ferait perdre son siège au passager
        // qui recompose correctement son code (B2).
        $this->assertSame(BookingStatus::PendingPayment, $booking->status);
        $this->assertSame(1, $booking->passengers()->where('holds_seat', true)->count());
    }

    public function test_several_attempts_can_follow_one_another_until_one_succeeds(): void
    {
        $booking = $this->book();

        FakePaymentGateway::willReject();
        $first = $this->initiate($booking, 'key-1');
        $this->assertSame(PaymentStatus::Failed, $first->status);

        $second = $this->initiate($booking, 'key-2');
        $this->confirm($second, PaymentStatus::Succeeded);

        $this->assertSame(2, $booking->payments()->count());
        $this->assertSame(1, $booking->payments()->where('status', 'SUCCEEDED')->count());
    }

    public function test_a_confirmed_payment_settles_the_booking_and_the_ledger(): void
    {
        $booking = $this->book();
        $payment = $this->initiate($booking);

        $this->confirm($payment, PaymentStatus::Succeeded);

        $booking->refresh();

        $this->assertSame(BookingStatus::Confirmed, $booking->status);
        $this->assertNotNull($booking->confirmed_at);
        // La tenue n'a plus d'objet : la place est vendue, pas tenue.
        $this->assertNull($booking->expires_at);

        // Commission à 8 %, exprimée en points de base sur les conditions
        // **figées** de la réservation, jamais sur celles courantes de l'agence.
        $commission = Commission::query()->where('booking_id', $booking->id)->firstOrFail();
        $this->assertSame(intdiv($booking->total_amount * 800, 10000), $commission->amount);

        $entries = AgencyLedgerEntry::query()->where('agency_id', $booking->agency_id)->get();
        $this->assertCount(2, $entries);
        $this->assertSame(
            $booking->total_amount - $commission->amount,
            (int) $entries->sum('amount'),
        );
    }

    public function test_replaying_a_webhook_changes_nothing(): void
    {
        $booking = $this->book();
        $payment = $this->initiate($booking);

        $this->confirm($payment, PaymentStatus::Succeeded, eventId: 'evt-1');
        $this->confirm($payment, PaymentStatus::Succeeded, eventId: 'evt-1');

        // Les prestataires réémettent : un rejeu ne doit produire ni seconde
        // commission ni écritures en double (§29).
        $this->assertSame(1, Commission::query()->count());
        $this->assertSame(2, AgencyLedgerEntry::query()->count());
    }

    /**
     * Le cas limite de B2 : le succès arrive après l'expiration de la tenue, et
     * les places ont été libérées. Le passager a payé et n'a plus de place.
     */
    public function test_a_payment_landing_after_expiry_is_refunded(): void
    {
        $booking = $this->book();
        $payment = $this->initiate($booking);

        $booking->update(['expires_at' => now()->subMinute()]);
        (new ReleaseExpiredHolds)->handle();

        $this->assertSame(BookingStatus::Expired, $booking->refresh()->status);

        $this->confirm($payment, PaymentStatus::Succeeded);

        $refund = Refund::query()->where('booking_id', $booking->id)->firstOrFail();

        $this->assertSame(RefundReason::LatePayment, $refund->reason);
        $this->assertSame($booking->total_amount, $refund->amount);

        // Aucune commission : le voyage n'aura pas lieu, et la prélever sur un
        // transport qui n'a pas eu lieu serait indéfendable face à l'agence (B5).
        $this->assertSame(0, Commission::query()->count());
    }

    public function test_an_expired_booking_refuses_a_new_attempt(): void
    {
        $booking = $this->book();
        $booking->update(['expires_at' => now()->subMinute()]);

        try {
            $this->initiate($booking, 'key-late');
            $this->fail('Un paiement a été accepté sur une tenue expirée.');
        } catch (ApiException $e) {
            $this->assertSame(ErrorCode::BookingExpired, $e->errorCode);
        }
    }

    public function test_a_paid_booking_refuses_a_second_charge(): void
    {
        $booking = $this->book();
        $this->confirm($this->initiate($booking), PaymentStatus::Succeeded);

        try {
            $this->initiate($booking->refresh(), 'key-again');
            $this->fail('Un second encaissement a été accepté.');
        } catch (ApiException $e) {
            $this->assertSame(ErrorCode::PaymentAlreadySucceeded, $e->errorCode);
        }
    }

    public function test_an_unknown_provider_reference_is_ignored_not_fatal(): void
    {
        $confirm = app(ConfirmPayment::class);

        // Un webhook peut concerner un autre environnement : il se journalise et
        // s'ignore, il ne fait pas tomber l'endpoint.
        $result = $confirm->handle(new WebhookEvent(
            eventId: 'evt-inconnu',
            providerReference: 'ref-inexistante',
            status: PaymentStatus::Succeeded,
        ));

        $this->assertNull($result);
    }

    private function book(): Booking
    {
        $trip = Trip::query()->where('reference', 'TR-SEATED')->firstOrFail();
        $seat = VehicleSeat::query()->where('vehicle_id', $trip->vehicle_id)->orderBy('id')->firstOrFail();

        return (new CreateBooking)->handle(new NewBooking(
            tripReference: $trip->reference,
            passengers: [new NewPassenger('Awa', 'Nkeng', null, $seat->id)],
            idempotencyKey: 'booking-'.bin2hex(random_bytes(4)),
            userId: User::factory()->create()->id,
        ));
    }

    private function initiate(Booking $booking, ?string $key = null): Payment
    {
        return app(InitiatePayment::class)->handle(
            booking: $booking,
            method: PaymentMethod::MobileMoney,
            operator: 'MTN',
            payerPhone: '+237690000001',
            idempotencyKey: $key ?? 'pay-'.bin2hex(random_bytes(4)),
        );
    }

    private function confirm(
        Payment $payment,
        PaymentStatus $status,
        ?string $reason = null,
        string $eventId = 'evt-defaut',
    ): void {
        app(ConfirmPayment::class)->handle(new WebhookEvent(
            eventId: $eventId,
            providerReference: (string) $payment->refresh()->provider_reference,
            status: $status,
            failureReason: $reason,
        ));
    }

    /**
     * **Un refus n'est pas une panne.**
     *
     * Le motif d'echec vient du prestataire et sa longueur ne nous appartient
     * pas. La colonne en tenait cent ; « Agregateur injoignable : cURL error 28…
     * » les depasse a lui seul. PostgreSQL refusait l'ecriture, et un refus de
     * paiement — le cas le plus banal en Mobile Money — remontait en 500 apres
     * que la sollicitation soit deja partie chez l'agregateur.
     *
     * Le passager voyait alors « Certaines informations sont incorrectes » sur ce
     * qui etait une erreur serveur.
     */
    public function test_a_long_refusal_is_recorded_instead_of_crashing(): void
    {
        // Un vrai message de dépassement de délai, tel que cURL le rend, suivi de
        // l'URL appelée : c'est la forme exacte qui a fait sauter la colonne.
        $verbose = 'Agrégateur injoignable : cURL error 28: Operation timed out after '
            .'20001 milliseconds with 0 bytes received (see https://curl.haxx.se/libcurl/c/'
            .'libcurl-errors.html) pour https://api.notchpay.co/payments/'
            .'trx_test_N6ZkLVvZzrDGnCeoNrbM6dlv — aucune réponse reçue de '
            ."l'agrégateur avant expiration du délai configuré de vingt secondes.";

        $this->assertGreaterThan(255, mb_strlen($verbose), 'Le motif doit dépasser la colonne.');

        FakePaymentGateway::willReject($verbose);

        $payment = $this->initiate($this->book());

        $this->assertSame(PaymentStatus::Failed, $payment->status);
        $this->assertNotNull($payment->failure_reason);
        $this->assertLessThanOrEqual(255, mb_strlen($payment->failure_reason));
        // Le début du motif survit : c'est lui qui renseigne le support.
        $this->assertStringStartsWith('Agrégateur injoignable', $payment->failure_reason);
    }

    /**
     * **Un refus immédiat n'est pas une acceptation.**
     *
     * `202` annonce « accepté, la suite arrivera » : le payeur doit saisir son
     * code, et le webhook tranchera. Quand l'agrégateur refuse d'emblée, il n'y a
     * plus de suite — rien n'arrivera par webhook, et la tentative est close.
     *
     * En production, le journal montrait un `202` rassurant pendant que l'écran
     * affichait « paiement non abouti ». Le corps disait vrai, le code de statut
     * mentait — et c'est le code de statut qu'on lit d'abord quand on cherche une
     * panne.
     */
    public function test_an_outright_refusal_is_not_reported_as_accepted(): void
    {
        FakePaymentGateway::willReject('Numéro invalide.');

        $booking = $this->book();

        $response = $this->actingAs(User::query()->findOrFail($booking->user_id))
            ->withHeader('Idempotency-Key', 'cle-refus-immediat')
            ->postJson("/api/v1/bookings/{$booking->reference}/payments", [
                'method' => 'MOBILE_MONEY',
                'operator' => 'MTN',
                'payer_phone' => '+237690000001',
            ]);

        $response->assertStatus(200)->assertJsonPath('status', 'FAILED');
    }

    /** Une sollicitation partie reste un `202` : le dénouement est à venir. */
    public function test_a_charge_awaiting_its_code_stays_accepted(): void
    {
        $booking = $this->book();

        $response = $this->actingAs(User::query()->findOrFail($booking->user_id))
            ->withHeader('Idempotency-Key', 'cle-en-cours')
            ->postJson("/api/v1/bookings/{$booking->reference}/payments", [
                'method' => 'MOBILE_MONEY',
                'operator' => 'MTN',
                'payer_phone' => '+237690000001',
            ]);

        $response->assertStatus(202)->assertJsonPath('status', 'PROCESSING');
    }
}
