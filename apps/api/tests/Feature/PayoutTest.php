<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Bookings\Actions\CancelBooking;
use App\Modules\Bookings\Actions\CreateBooking;
use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Data\NewPassenger;
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
use App\Modules\Payments\Gateways\FakePaymentGateway;
use App\Modules\Payouts\Actions\AdjustLedger;
use App\Modules\Payouts\Actions\ApprovePayout;
use App\Modules\Payouts\Actions\BuildDuePayouts;
use App\Modules\Payouts\Actions\BuildPayout;
use App\Modules\Payouts\Actions\ConfirmPayout;
use App\Modules\Payouts\Actions\SendPayout;
use App\Modules\Payouts\Data\DisbursementEvent;
use App\Modules\Payouts\Enums\LedgerEntryType;
use App\Modules\Payouts\Enums\PayoutStatus;
use App\Modules\Payouts\Gateways\FakePayoutGateway;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Payee;
use App\Modules\Payouts\Models\Payout;
use App\Modules\Payouts\Support\EligibleBalance;
use App\Modules\Trips\Models\Trip;
use Carbon\CarbonImmutable;
use Database\Seeders\CountrySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Support\BuildsSearchFixtures;
use Tests\TestCase;

/**
 * Reversements (B4).
 *
 * **Un reversement n'est qu'une opération de solde du compte courant jusqu'à une
 * date donnée.** Le compte courant a été préféré à un calcul par période parce
 * qu'il absorbe les soldes négatifs, les régularisations tardives et les
 * corrections manuelles — ce sont exactement les cas que ce test exerce.
 */
final class PayoutTest extends TestCase
{
    use BuildsSearchFixtures;
    use RefreshDatabase;

    private Trip $trip;

    private Agency $agency;

    private User $admin;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        FakePaymentGateway::reset();
        FakePayoutGateway::reset();
        $this->seed(CountrySeeder::class);
        $this->seed(RoleAndPermissionSeeder::class);
        $this->buildNetwork();

        $this->trip = Trip::query()->where('reference', 'TR-SEATED')->firstOrFail();
        $this->agency = $this->trip->agency()->firstOrFail();

        $this->admin = $this->userWith(RoleEnum::Admin, null);
        $this->manager = $this->userWith(RoleEnum::Agency, $this->agency->id);

        $this->agency->payoutAccounts()->create([
            'type' => 'MOBILE_MONEY',
            'operator' => 'MTN',
            'account_number' => '+237690000123',
            'account_name' => 'Général Express',
            'verified_at' => now(),
            'is_active' => true,
        ]);
    }

    public function test_nothing_is_paid_out_before_the_departure_has_left(): void
    {
        $this->paidBooking();

        // Le départ est demain : reverser avant est la seule configuration qui
        // crée une créance irrécupérable — un remboursement survenant après un
        // versement Mobile Money ne se récupère pas par une procédure.
        $this->trip->update(['departure_at' => CarbonImmutable::now()->addDay()]);

        $result = app(BuildPayout::class)->handle($this->agency);

        $this->assertNull($result['payout']);
        $this->assertSame('NOTHING_ELIGIBLE', $result['reason']);
    }

    public function test_the_delay_after_departure_is_respected(): void
    {
        $this->paidBooking();

        // Parti, mais il y a une heure : le délai par défaut est de 24 h.
        $this->trip->update(['departure_at' => CarbonImmutable::now()->subHour()]);
        $this->assertNull(app(BuildPayout::class)->handle($this->agency)['payout']);

        $this->trip->update(['departure_at' => CarbonImmutable::now()->subHours(25)]);
        $this->assertNotNull(app(BuildPayout::class)->handle($this->agency)['payout']);
    }

    public function test_the_net_is_the_running_account_and_the_detail_justifies_it(): void
    {
        $booking = $this->paidBooking(fee: 100);
        $this->depart();

        $payout = app(BuildPayout::class)->handle($this->agency)['payout'];
        $this->assertInstanceOf(Payout::class, $payout);

        $commission = intdiv($booking->total_amount * 800, 10000);

        $this->assertSame($booking->total_amount, $payout->gross_amount);
        $this->assertSame($commission, $payout->commission_amount);
        $this->assertSame(0, $payout->refund_amount);
        $this->assertSame($booking->total_amount - $commission, $payout->net_amount);

        // La somme du compte courant fait foi ; le détail doit s'y recomposer.
        $this->assertSame(
            (int) AgencyLedgerEntry::query()->where('agency_id', $this->agency->id)->sum('amount'),
            $payout->net_amount,
        );

        $line = $payout->lines()->firstOrFail();
        $this->assertSame($booking->id, $line->booking_id);
        $this->assertSame($booking->total_amount - $commission, $line->net_amount);

        // Le calcul est automatique, le déclenchement est manuel : rien n'est
        // parti.
        $this->assertSame(PayoutStatus::PendingValidation, $payout->status);
        $this->assertNull($payout->paid_at);
    }

    /**
     * Le cas que le compte courant existe pour absorber : un remboursement
     * arrivé après coup.
     */
    public function test_a_late_refund_lands_in_the_next_payout(): void
    {
        $booking = $this->paidBooking();
        $this->depart();

        $first = app(BuildPayout::class)->handle($this->agency)['payout'];
        $this->assertInstanceOf(Payout::class, $first);
        $this->send($first);
        $this->settle($first);

        $this->assertSame(PayoutStatus::Paid, $first->refresh()->status);

        // Le solde est apuré : le débit du reversement l'a soldé.
        $this->assertSame(0, EligibleBalance::amount($this->agency->id, 24));

        // Le passager annule après coup. Le départ étant parti, l'annulation
        // passe par l'agence.
        $this->trip->update(['departure_at' => CarbonImmutable::now()->addDay()]);
        app(CancelBooking::class)->handle($booking->refresh());
        $this->depart();

        $second = app(BuildPayout::class)->handle($this->agency);

        // Solde négatif : rien n'est versé, et la dette reste au compte. C'est
        // tout l'intérêt du compte courant sur un calcul par période.
        $this->assertNull($second['payout']);
        $this->assertSame('NEGATIVE_BALANCE', $second['reason']);
        $this->assertLessThan(0, $second['balance']);
        $this->assertLessThan(0, EligibleBalance::amount($this->agency->id, 24));
    }

    public function test_a_payout_in_flight_blocks_a_second_one(): void
    {
        $this->paidBooking();
        $this->depart();

        $first = app(BuildPayout::class)->handle($this->agency);
        $this->assertInstanceOf(Payout::class, $first['payout']);

        // Sans ce garde-fou, le second verrait un solde encore entier — le débit
        // n'étant écrit qu'à l'envoi — et paierait une seconde fois.
        $second = app(BuildPayout::class)->handle($this->agency);
        $this->assertNull($second['payout']);
        $this->assertSame('PAYOUT_IN_FLIGHT', $second['reason']);
    }

    public function test_nothing_is_paid_below_the_minimum(): void
    {
        $this->paidBooking();
        $this->depart();

        $this->agency->commercialTerms()->update(['payout_minimum_amount' => 1_000_000]);

        $result = app(BuildPayout::class)->handle($this->agency);

        $this->assertNull($result['payout']);
        $this->assertSame('BELOW_MINIMUM', $result['reason']);
        $this->assertGreaterThan(0, $result['balance']);
    }

    public function test_nothing_is_paid_to_an_unverified_account(): void
    {
        $this->paidBooking();
        $this->depart();

        // Une erreur de saisie envoie l'argent à un inconnu, sans recours.
        $this->agency->payoutAccounts()->update(['verified_at' => null]);

        $result = app(BuildPayout::class)->handle($this->agency);

        $this->assertNull($result['payout']);
        $this->assertSame('NO_VERIFIED_ACCOUNT', $result['reason']);
    }

    public function test_the_disbursement_debits_the_account_at_send_time(): void
    {
        $this->paidBooking();
        $this->depart();

        $payout = app(BuildPayout::class)->handle($this->agency)['payout'];
        $this->assertInstanceOf(Payout::class, $payout);

        $this->approve($payout)->assertOk();
        $this->assertSame(0, $this->debits());

        $this->send($payout)->assertOk();

        // Écrit à l'envoi, pas à la confirmation : sinon un reversement construit
        // pendant que celui-ci est en vol paierait deux fois.
        $this->assertSame(1, $this->debits());
        $this->assertSame(-$payout->net_amount, (int) AgencyLedgerEntry::query()
            ->where('type', LedgerEntryType::PayoutDebit)->sum('amount'));
        $this->assertSame(PayoutStatus::Processing, $payout->refresh()->status);
    }

    public function test_a_failed_disbursement_is_reversed_not_erased(): void
    {
        $this->paidBooking();
        $this->depart();

        $payout = app(BuildPayout::class)->handle($this->agency)['payout'];
        $this->assertInstanceOf(Payout::class, $payout);
        $this->approve($payout)->assertOk();

        FakePayoutGateway::willReject();
        $this->send($payout)->assertOk();

        $payout->refresh();
        $this->assertSame(PayoutStatus::Failed, $payout->status);
        $this->assertNotNull($payout->failure_reason);

        // Le débit reste, contre-passé par un crédit : un compte courant se
        // corrige par écriture inverse, jamais par suppression. Le solde est
        // donc retrouvé à l'identique.
        $this->assertSame(1, $this->debits());
        $this->assertSame(1, AgencyLedgerEntry::query()
            ->where('type', LedgerEntryType::PayoutReversalCredit)->count());

        $booking = Booking::query()->firstOrFail();
        $commission = intdiv($booking->total_amount * 800, 10000);
        $this->assertSame($booking->total_amount - $commission, EligibleBalance::amount($this->agency->id, 24));
    }

    public function test_an_unapproved_payout_cannot_be_sent(): void
    {
        $this->paidBooking();
        $this->depart();

        $payout = app(BuildPayout::class)->handle($this->agency)['payout'];
        $this->assertInstanceOf(Payout::class, $payout);

        $this->sendRaw($payout)
            ->assertStatus(409)
            ->assertJsonPath('code', 'PAYOUT_NOT_SENDABLE');

        // Rien n'a bougé au compte courant.
        $this->assertSame(0, $this->debits());
    }

    public function test_approving_twice_is_refused(): void
    {
        $this->paidBooking();
        $this->depart();

        $payout = app(BuildPayout::class)->handle($this->agency)['payout'];
        $this->assertInstanceOf(Payout::class, $payout);

        $this->approve($payout)->assertOk();
        $this->approve($payout)
            ->assertStatus(409)
            ->assertJsonPath('code', 'PAYOUT_NOT_APPROVABLE');
    }

    public function test_an_agency_manager_reaches_no_admin_endpoint(): void
    {
        $this->actingAs($this->manager)
            ->postJson('/api/v1/admin/payouts/build')
            ->assertStatus(403);
    }

    public function test_the_agency_reads_its_statement_and_its_running_account(): void
    {
        $booking = $this->paidBooking();
        $this->depart();

        $payout = app(BuildPayout::class)->handle($this->agency)['payout'];
        $this->assertInstanceOf(Payout::class, $payout);

        $detail = $this->actingAs($this->manager)
            ->getJson("/api/v1/agency/payouts/{$payout->reference}")
            ->assertOk()
            ->json();

        $this->assertSame($payout->net_amount, $detail['net']['amount']);
        $this->assertSame($booking->reference, $detail['lines'][0]['booking_reference']);

        // Le numéro complet n'a pas à circuler : le changer est un vecteur de
        // fraude classique, le lire en est la première étape.
        $this->assertStringNotContainsString('690000123', $detail['account']['masked_number']);
        $this->assertTrue($detail['account']['verified']);

        $ledger = $this->actingAs($this->manager)
            ->getJson('/api/v1/agency/ledger')
            ->assertOk()
            ->json();

        $this->assertSame($payout->net_amount, $ledger['balance']['amount']);
        $this->assertSame($payout->net_amount, $ledger['eligible_balance']['amount']);
    }

    public function test_the_statement_downloads_as_a_spreadsheet(): void
    {
        $booking = $this->paidBooking();
        $this->depart();

        $payout = app(BuildPayout::class)->handle($this->agency)['payout'];
        $this->assertInstanceOf(Payout::class, $payout);

        $response = $this->actingAs($this->manager)
            ->get("/api/v1/agency/payouts/{$payout->reference}/statement")
            ->assertOk();

        $csv = $response->streamedContent();

        $this->assertStringContainsString($payout->reference, $csv);
        $this->assertStringContainsString($booking->reference, $csv);
        // Sans le BOM, Excel casse tout accent et le relevé censé clore un
        // litige en ouvre un.
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
    }

    public function test_an_agency_never_sees_another_agency_payout(): void
    {
        $other = Agency::query()->where('id', '!=', $this->agency->id)->firstOrFail();

        $payout = Payout::query()->create([
            'reference' => 'PYT-AUTRE',
            'agency_id' => $other->id,
            'period_start' => CarbonImmutable::today()->toDateString(),
            'period_end' => CarbonImmutable::today()->toDateString(),
            'gross_amount' => 1000, 'commission_amount' => 0, 'refund_amount' => 0,
            'adjustment_amount' => 0, 'net_amount' => 1000, 'currency' => 'XAF',
            'payout_account_id' => $other->payoutAccounts()->create([
                'type' => 'MOBILE_MONEY', 'account_number' => '+237690000999',
                'account_name' => 'Western Voyages', 'is_active' => true,
            ])->id,
            'status' => PayoutStatus::PendingValidation,
        ]);

        $this->actingAs($this->manager)
            ->getJson("/api/v1/agency/payouts/{$payout->reference}")
            ->assertStatus(404)
            ->assertJsonPath('code', 'NOT_FOUND');
    }

    public function test_the_build_endpoint_says_what_it_skipped(): void
    {
        $this->paidBooking();
        $this->trip->update(['departure_at' => CarbonImmutable::now()->addDay()]);

        $response = $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/payouts/build')
            ->assertOk()
            ->json();

        // Une omission silencieuse se lirait comme « rien à verser », ce qui
        // n'est pas la même chose que « sous le seuil » ou « en vol ».
        $this->assertSame([], $response['created']);
        $this->assertNotEmpty($response['skipped']);
    }

    public function test_a_counter_sale_is_never_paid_out(): void
    {
        // L'agence a encaissé les espèces elle-même : rien à lui reverser, donc
        // aucune écriture au crédit, donc rien d'éligible (I2).
        $this->depart();

        $result = app(BuildDuePayouts::class)->handle($this->agency->id, force: true);

        $this->assertSame([], $result['created']);
    }

    private function debits(): int
    {
        return AgencyLedgerEntry::query()->where('type', LedgerEntryType::PayoutDebit)->count();
    }

    /** @return TestResponse<JsonResponse> */
    private function approve(Payout $payout): TestResponse
    {
        return $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/payouts/{$payout->reference}/approve");
    }

    /** @return TestResponse<JsonResponse> */
    private function send(Payout $payout): TestResponse
    {
        if ($payout->refresh()->status === PayoutStatus::PendingValidation) {
            $this->approve($payout);
        }

        return $this->sendRaw($payout);
    }

    /** @return TestResponse<JsonResponse> */
    private function sendRaw(Payout $payout): TestResponse
    {
        return $this->actingAs($this->admin)
            ->withHeader('Idempotency-Key', 'pay-'.bin2hex(random_bytes(4)))
            ->postJson("/api/v1/admin/payouts/{$payout->reference}/send");
    }

    /** Le prestataire confirme : c'est ce qui sort le reversement de PROCESSING. */
    private function settle(Payout $payout, PayoutStatus $status = PayoutStatus::Paid): void
    {
        $this->postJson('/api/v1/webhooks/payouts/fake', [
            'event_id' => 'evt-pyt-'.bin2hex(random_bytes(4)),
            'reference' => $payout->refresh()->provider_reference,
            'status' => $status->value,
        ])->assertNoContent();
    }

    /** Fait partir le départ il y a plus que le délai d'éligibilité. */
    private function depart(): void
    {
        $this->trip->update(['departure_at' => CarbonImmutable::now()->subHours(48)]);
    }

    private function paidBooking(int $fee = 0): Booking
    {
        $taken = DB::table('booking_passengers')->whereNotNull('seat_id')->pluck('seat_id')->all();

        $seat = VehicleSeat::query()
            ->where('vehicle_id', $this->trip->vehicle_id)
            ->whereNotIn('id', $taken)
            ->orderBy('id')
            ->firstOrFail();

        $booking = app(CreateBooking::class)->handle(new NewBooking(
            tripReference: $this->trip->reference,
            passengers: [new NewPassenger('Awa', 'Nkeng', null, $seat->id)],
            idempotencyKey: 'booking-'.bin2hex(random_bytes(4)),
            userId: User::factory()->create()->id,
        ));

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

    private function userWith(RoleEnum $role, ?int $agencyId): User
    {
        $user = User::factory()->create();

        DB::table('role_user')->insert([
            'user_id' => $user->id,
            'role_id' => Role::query()->where('name', $role->value)->value('id'),
            'agency_id' => $agencyId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $user;
    }

    /**
     * Le grand livre pointe un beneficiaire, pas une agence.
     *
     * C'est ce qui permettra de payer un chauffeur independant (E4) sans
     * retoucher le code qui compte l'argent. Le pont derive encore le
     * beneficiaire de l'agence, et cette derivation doit tenir.
     */
    public function test_every_ledger_entry_carries_a_payee(): void
    {
        $this->paidBooking();

        $entries = AgencyLedgerEntry::query()->get();

        $this->assertNotEmpty($entries);
        $this->assertTrue($entries->every(fn (AgencyLedgerEntry $entry) => $entry->payee_id !== null));

        $payee = Payee::query()->where('agency_id', $this->agency->id)->firstOrFail();

        $this->assertSame(Payee::KIND_AGENCY, $payee->kind);
        $this->assertSame($payee->id, $entries->first()?->payee_id);
    }

    /**
     * Les deux ecritures qu'aucun test ne parcourait.
     *
     * **Ce test existe a cause de la contraction.** Le pont qui derivait le
     * beneficiaire de l'agence a ete retire, chaque appelant le passant desormais
     * lui-meme. Sept actions ont ete reprises ; cinq etaient exercees
     * indirectement — une vente au comptoir, un remboursement, un reglement — et
     * `payee_id` etant obligatoire en base, une expression fausse y aurait echoue
     * bruyamment.
     *
     * Ces deux-la, non : un ajustement manuel et la contre-passation d'un
     * reversement en echec ne sont declenches par aucun autre test. Les retirer du
     * pont sans les couvrir aurait ete un pari sur du code qui compte de l'argent,
     * dont la premiere occasion de se tromper aurait ete la production.
     */
    public function test_a_manual_adjustment_and_a_failed_payout_name_their_payee(): void
    {
        $before = AgencyLedgerEntry::query()->count();

        $adjustment = app(AdjustLedger::class)->handle(
            $this->agency,
            -2_500,
            'Correction manuelle, litige resolu.',
            $this->admin->id,
        );

        $payee = Payee::query()->where('agency_id', $this->agency->id)->firstOrFail();

        $this->assertSame($payee->id, $adjustment->payee_id);
        $this->assertSame($this->agency->id, $adjustment->agency_id);

        // Un reversement parti puis refuse par l'operateur : le debit ecrit a
        // l'envoi doit etre contre-passe, faute de quoi l'agence apparaitrait
        // payee alors qu'elle ne l'est pas.
        $this->paidBooking();
        $this->depart();

        $payout = app(BuildPayout::class)->handle($this->agency)['payout'];
        $this->assertNotNull($payout);

        app(ApprovePayout::class)->handle($payout, $this->admin->id);
        $sent = app(SendPayout::class)->handle($payout->refresh(), 'test-'.$payout->reference);

        app(ConfirmPayout::class)->handle(new DisbursementEvent(
            eventId: 'evt-'.$sent->reference,
            providerReference: (string) $sent->provider_reference,
            status: PayoutStatus::Failed,
            failureReason: 'Numero inconnu chez cet operateur.',
        ));

        $reversal = AgencyLedgerEntry::query()
            ->where('type', LedgerEntryType::PayoutReversalCredit->value)
            ->firstOrFail();

        $this->assertSame($payee->id, $reversal->payee_id);
        $this->assertSame((int) $payout->net_amount, (int) $reversal->amount);

        // Aucune ecriture n'a echappe au beneficiaire, y compris celles ecrites
        // en chemin par l'envoi.
        $entries = AgencyLedgerEntry::query()->get();
        $this->assertGreaterThan($before, $entries->count());
        $this->assertTrue($entries->every(fn (AgencyLedgerEntry $e) => $e->payee_id !== null));
    }

    /**
     * Une personne peut etre beneficiaire, et la contrainte de base refuse un
     * beneficiaire qui melange les deux genres : sans elle, une ligne sans
     * destinataire serait representable.
     */
    public function test_a_person_can_be_a_payee_and_the_kinds_do_not_mix(): void
    {
        $driver = User::factory()->create();

        $payee = Payee::forUser($driver->id);

        $this->assertSame(Payee::KIND_DRIVER, $payee->kind);
        $this->assertNull($payee->agency_id);

        $this->expectException(QueryException::class);

        Payee::query()->create([
            'kind' => Payee::KIND_DRIVER,
            'agency_id' => $this->agency->id,
        ]);
    }
}
