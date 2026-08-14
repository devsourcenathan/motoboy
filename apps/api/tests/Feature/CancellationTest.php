<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Bookings\Actions\CancelBooking;
use App\Modules\Bookings\Actions\CreateBooking;
use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Data\NewPassenger;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Fleet\Models\VehicleSeat;
use App\Modules\Identity\Models\User;
use App\Modules\Payments\Actions\ConfirmPayment;
use App\Modules\Payments\Actions\ConfirmRefund;
use App\Modules\Payments\Actions\InitiatePayment;
use App\Modules\Payments\Actions\RetryFailedRefunds;
use App\Modules\Payments\Data\RefundEvent;
use App\Modules\Payments\Data\WebhookEvent;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Enums\RefundReason;
use App\Modules\Payments\Enums\RefundStatus;
use App\Modules\Payments\Gateways\FakePaymentGateway;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Tickets\Enums\TicketStatus;
use App\Modules\Trips\Models\Trip;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Carbon\CarbonImmutable;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Support\BuildsSearchFixtures;
use Tests\TestCase;

/**
 * Annulation à l'initiative du passager (B5-A).
 *
 * Le flux d'argent est le point délicat : MOTOBOY **renonce à sa commission**
 * mais **récupère ses frais réels**, et le solde revient à l'agence, qui subit
 * la perte du siège.
 */
final class CancellationTest extends TestCase
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

        // Le fixture date le départ d'aujourd'hui 8 h, souvent déjà passé : le
        // délai d'annulation se calcule depuis le départ, il doit être devant.
        $this->trip->update(['departure_at' => CarbonImmutable::now()->addDay()]);
    }

    public function test_the_passenger_is_refunded_minus_the_cancellation_fee(): void
    {
        $booking = $this->paidBooking();

        $result = $this->cancel($booking);

        // Frais à 20 %, exprimés en points de base sur les conditions **figées**
        // de la réservation, jamais sur celles courantes de l'agence.
        $fee = intdiv($booking->total_amount * 2000, 10000);

        $this->assertSame($fee, $result['fee']);
        $this->assertSame($booking->total_amount - $fee, $result['refunded']);

        $refund = $result['refund'];
        $this->assertInstanceOf(Refund::class, $refund);
        $this->assertSame(RefundReason::PassengerRequest, $refund->reason);
        $this->assertSame($fee, $refund->fee_amount);
    }

    /**
     * La répartition de B5, vérifiée au franc près sur le compte courant.
     */
    public function test_motoboy_gives_up_its_commission_but_keeps_its_real_costs(): void
    {
        $booking = $this->paidBooking(fee: 100);

        $commission = intdiv($booking->total_amount * 800, 10000);
        $cancellationFee = intdiv($booking->total_amount * 2000, 10000);

        $this->cancel($booking);

        $entries = AgencyLedgerEntry::query()->where('agency_id', $booking->agency_id)->get();

        // Le crédit et le débit de commission d'origine restent : un compte
        // courant se corrige par contre-passation, jamais par réécriture.
        $this->assertSame($booking->total_amount, (int) $entries->firstWhere('type', 'BOOKING_CREDIT')?->amount);
        $this->assertSame(-$commission, (int) $entries->firstWhere('type', 'COMMISSION_DEBIT')?->amount);

        $this->assertSame($commission, (int) $entries->firstWhere('type', 'COMMISSION_REVERSAL_CREDIT')?->amount);
        $this->assertSame(-100, (int) $entries->firstWhere('type', 'AGGREGATOR_FEE_DEBIT')?->amount);

        // Solde final : l'agence garde les frais retenus moins les frais réels
        // de MOTOBOY, et rien d'autre.
        $this->assertSame($cancellationFee - 100, (int) $entries->sum('amount'));
    }

    public function test_motoboy_absorbs_the_difference_when_the_fee_is_smaller_than_its_costs(): void
    {
        // Frais d'annulation à 1 %, frais d'agrégateur bien supérieurs.
        $booking = $this->paidBooking(fee: 500, cancellationFeeValue: 100);

        $cancellationFee = intdiv($booking->total_amount * 100, 10000);
        $this->assertLessThan(500, $cancellationFee);

        $this->cancel($booking);

        $recovered = AgencyLedgerEntry::query()
            ->where('agency_id', $booking->agency_id)
            ->where('type', 'AGGREGATOR_FEE_DEBIT')
            ->sum('amount');

        // Plafonné aux frais retenus : au-delà, MOTOBOY absorbe. Réclamer la
        // différence à l'agence produirait une créance de quelques dizaines de
        // francs, indéfendable et impossible à recouvrer.
        $this->assertSame(-$cancellationFee, (int) $recovered);
        $this->assertSame(0, (int) AgencyLedgerEntry::query()->where('agency_id', $booking->agency_id)->sum('amount'));
    }

    public function test_a_partial_cancellation_leaves_the_other_passengers_travelling(): void
    {
        $booking = $this->paidBooking(seats: 3);
        $cancelled = $booking->passengers()->orderBy('id')->first();
        $this->assertNotNull($cancelled);

        $result = $this->cancel($booking, [$cancelled->id]);

        $booking->refresh();

        // Ce qui a été payé ne bouge pas : `total_amount` et `seats_count`
        // décrivent l'encaissement, les modifier ferait diverger la réservation
        // du paiement qui la couvre.
        $this->assertSame(BookingStatus::Confirmed, $booking->status);
        $this->assertSame(3, $booking->seats_count);
        $this->assertSame(2, $booking->activePassengers()->count());

        // Le siège repart à la vente : c'est `holds_seat` que lit l'index unique.
        $this->assertFalse((bool) $cancelled->refresh()->holds_seat);
        $this->assertSame(2, $booking->passengers()->where('holds_seat', true)->count());

        // Un tiers du montant, un tiers des frais, un tiers de la commission.
        $share = intdiv($booking->total_amount, 3);
        $this->assertSame(intdiv($share * 2000, 10000), $result['fee']);
        $this->assertSame(TicketStatus::Cancelled, $cancelled->ticket?->refresh()->status);
        $this->assertSame(2, $booking->tickets()->where('status', TicketStatus::Valid)->count());
    }

    public function test_the_booking_closes_when_the_last_passenger_leaves(): void
    {
        $booking = $this->paidBooking(seats: 2);
        $ids = $booking->passengers()->orderBy('id')->pluck('id')->all();

        $this->cancel($booking, [(int) $ids[0]]);
        $this->assertSame(BookingStatus::Confirmed, $booking->refresh()->status);

        $this->cancel($booking->refresh(), [(int) $ids[1]]);
        $this->assertSame(BookingStatus::CancelledByPassenger, $booking->refresh()->status);
        $this->assertNotNull($booking->cancelled_at);
    }

    public function test_the_quote_says_what_the_cancellation_will_cost_without_doing_it(): void
    {
        $booking = $this->paidBooking();
        $user = User::query()->whereKey($booking->user_id)->firstOrFail();

        $quote = $this->actingAs($user)
            ->getJson("/api/v1/bookings/{$booking->reference}/cancellation-quote")
            ->assertOk()
            ->json();

        $fee = intdiv($booking->total_amount * 2000, 10000);

        $this->assertTrue($quote['cancellable']);
        $this->assertSame($fee, $quote['fee']['amount']);
        $this->assertSame($booking->total_amount - $fee, $quote['refundable']['amount']);

        // Rien n'a été exécuté : c'est tout l'objet du devis.
        $this->assertSame(0, Refund::query()->count());
        $this->assertSame(BookingStatus::Confirmed, $booking->refresh()->status);
    }

    public function test_past_the_deadline_the_cancellation_is_refused(): void
    {
        $booking = $this->paidBooking();

        // Le délai figé sur la réservation est de deux heures avant le départ.
        $this->trip->update(['departure_at' => CarbonImmutable::now()->addHour()]);

        try {
            $this->cancel($booking->refresh());
            $this->fail('Une annulation a été acceptée au-delà du délai.');
        } catch (ApiException $e) {
            $this->assertSame(ErrorCode::CancellationDeadlinePassed, $e->errorCode);
        }

        $this->assertSame(BookingStatus::Confirmed, $booking->refresh()->status);
    }

    public function test_an_unpaid_booking_is_not_cancellable(): void
    {
        $booking = $this->book();

        try {
            $this->cancel($booking);
            $this->fail('Une réservation non confirmée a été annulée.');
        } catch (ApiException $e) {
            $this->assertSame(ErrorCode::BookingNotCancellable, $e->errorCode);
        }
    }

    public function test_a_passenger_of_another_booking_is_refused(): void
    {
        $booking = $this->paidBooking();
        $other = $this->paidBooking();
        $foreign = $other->passengers()->firstOrFail();

        try {
            $this->cancel($booking, [$foreign->id]);
            $this->fail('Un passager étranger à la réservation a été annulé.');
        } catch (ApiException $e) {
            $this->assertSame(ErrorCode::ValidationFailed, $e->errorCode);
        }
    }

    /**
     * Le remboursement part vers le prestataire, et n'est **jamais** terminé
     * synchronement : c'est le webhook qui tranche.
     */
    public function test_the_refund_is_sent_to_the_provider_and_stays_open(): void
    {
        $refund = $this->cancel($this->paidBooking())['refund'];

        $this->assertInstanceOf(Refund::class, $refund);
        $this->assertSame(RefundStatus::Processing, $refund->status);
        $this->assertNotNull($refund->provider_reference);
        $this->assertNull($refund->completed_at);
    }

    public function test_the_real_refund_cost_lands_when_the_provider_confirms_it(): void
    {
        $booking = $this->paidBooking(fee: 100);
        $refund = $this->cancel($booking)['refund'];
        $this->assertInstanceOf(Refund::class, $refund);

        app(ConfirmRefund::class)->handle(new RefundEvent(
            eventId: 'evt-rfd-1',
            providerReference: (string) $refund->provider_reference,
            status: RefundStatus::Completed,
            feeAmount: 80,
        ));

        $refund->refresh();
        $this->assertSame(RefundStatus::Completed, $refund->status);
        $this->assertNotNull($refund->completed_at);

        // Deux débits de frais : la collecte, connue à l'annulation, puis le
        // remboursement, connu seulement maintenant.
        $fees = AgencyLedgerEntry::query()->where('type', 'AGGREGATOR_FEE_DEBIT')->get();
        $this->assertCount(2, $fees);
        $this->assertSame(-180, (int) $fees->sum('amount'));
    }

    public function test_the_recovered_cost_never_exceeds_the_retained_fee(): void
    {
        $booking = $this->paidBooking(fee: 100, cancellationFeeValue: 200);
        $retained = intdiv($booking->total_amount * 200, 10000);

        $refund = $this->cancel($booking)['refund'];
        $this->assertInstanceOf(Refund::class, $refund);

        app(ConfirmRefund::class)->handle(new RefundEvent(
            eventId: 'evt-rfd-2',
            providerReference: (string) $refund->provider_reference,
            status: RefundStatus::Completed,
            feeAmount: 5000,
        ));

        $recovered = AgencyLedgerEntry::query()->where('type', 'AGGREGATOR_FEE_DEBIT')->sum('amount');

        // Au-delà des frais retenus, MOTOBOY absorbe — quel que soit le coût
        // annoncé par le prestataire.
        $this->assertSame(-$retained, (int) $recovered);
    }

    public function test_a_replayed_refund_webhook_changes_nothing(): void
    {
        $refund = $this->cancel($this->paidBooking(fee: 100))['refund'];
        $this->assertInstanceOf(Refund::class, $refund);

        $event = new RefundEvent(
            eventId: 'evt-rfd-3',
            providerReference: (string) $refund->provider_reference,
            status: RefundStatus::Completed,
            feeAmount: 50,
        );

        app(ConfirmRefund::class)->handle($event);
        app(ConfirmRefund::class)->handle($event);

        $this->assertCount(2, AgencyLedgerEntry::query()->where('type', 'AGGREGATOR_FEE_DEBIT')->get());
    }

    /**
     * Le pire état possible pour un passager : sans argent et sans billet.
     */
    public function test_a_failed_refund_is_retried_then_stops(): void
    {
        $booking = $this->paidBooking();

        FakePaymentGateway::willRejectRefund();
        $refund = $this->cancel($booking)['refund'];
        $this->assertInstanceOf(Refund::class, $refund);
        $this->assertSame(RefundStatus::Failed, $refund->status);

        // L'annulation elle-même a bien eu lieu : la place est libérée, le
        // passager n'attend pas le prestataire pour récupérer son siège.
        $this->assertSame(BookingStatus::CancelledByPassenger, $booking->refresh()->status);

        $retry = app(RetryFailedRefunds::class);

        FakePaymentGateway::willRejectRefund();
        $this->assertSame(1, $retry->handle());
        $this->assertSame(1, $refund->refresh()->retry_count);

        // Le rejeu finit par aboutir dès que le prestataire répond.
        $this->assertSame(1, $retry->handle());
        $this->assertSame(RefundStatus::Processing, $refund->refresh()->status);

        // Plus rien à reprendre.
        $this->assertSame(0, $retry->handle());
    }

    public function test_the_retry_gives_up_after_three_attempts(): void
    {
        FakePaymentGateway::willRejectRefund();
        $refund = $this->cancel($this->paidBooking())['refund'];
        $this->assertInstanceOf(Refund::class, $refund);

        $retry = app(RetryFailedRefunds::class);

        for ($attempt = 0; $attempt < RetryFailedRefunds::MAX_ATTEMPTS; $attempt++) {
            FakePaymentGateway::willRejectRefund();
            $retry->handle();
        }

        $this->assertSame(RetryFailedRefunds::MAX_ATTEMPTS, $refund->refresh()->retry_count);

        // Au-delà, réessayer ne ferait que retarder l'intervention humaine tout
        // en noyant le journal.
        $this->assertSame(0, $retry->handle());
        $this->assertSame(RefundStatus::Failed, $refund->refresh()->status);
    }

    /**
     * @param  list<int>  $passengerIds
     * @return array{booking: Booking, refund: Refund|null, refunded: int, fee: int, cancelled: list<int>}
     */
    private function cancel(Booking $booking, array $passengerIds = []): array
    {
        return app(CancelBooking::class)->handle($booking, $passengerIds, $booking->user_id);
    }

    private function paidBooking(int $seats = 1, int $fee = 0, ?int $cancellationFeeValue = null): Booking
    {
        $booking = $this->book($seats);

        if ($cancellationFeeValue !== null) {
            $booking->update(['cancellation_fee_value' => $cancellationFeeValue]);
        }

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

    private function book(int $seats = 1): Booking
    {
        $chosen = VehicleSeat::query()
            ->where('vehicle_id', $this->trip->vehicle_id)
            ->whereNotIn('id', Payment::query()->getConnection()
                ->table('booking_passengers')
                ->whereNotNull('seat_id')
                ->pluck('seat_id')
                ->all())
            ->orderBy('id')
            ->take($seats)
            ->get();

        $passengers = [];

        foreach ($chosen as $index => $seat) {
            $passengers[] = new NewPassenger('Passager'.$index, 'Test', null, $seat->id);
        }

        return app(CreateBooking::class)->handle(new NewBooking(
            tripReference: $this->trip->reference,
            passengers: $passengers,
            idempotencyKey: 'booking-'.bin2hex(random_bytes(4)),
            userId: User::factory()->create()->id,
        ));
    }
}
