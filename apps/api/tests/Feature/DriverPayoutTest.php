<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Administration\Support\RidePayoutTerms;
use App\Modules\Agencies\Actions\ManagePayoutAccount;
use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Identity\Models\User;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payouts\Actions\BuildDriverPayout;
use App\Modules\Payouts\Models\Payee;
use App\Modules\Payouts\Models\PayoutAccount;
use App\Modules\Places\Models\City;
use App\Modules\Rides\Actions\AcceptOffer;
use App\Modules\Rides\Actions\AdvanceRide;
use App\Modules\Rides\Actions\MakeOffer;
use App\Modules\Rides\Actions\OpenServiceRequest;
use App\Modules\Rides\Actions\PayForRide;
use App\Modules\Rides\Enums\DriverStatus;
use App\Modules\Rides\Models\DriverProfile;
use App\Modules\Rides\Models\Ride;
use Carbon\CarbonImmutable;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Le reversement d'un chauffeur, de la course au virement propose (E4 bis).
 *
 * Ce fichier protege en priorite ce qu'un chauffeur constate lui-meme : **son
 * solde, et le fait que rien ne part vers un compte non verifie.**
 */
final class DriverPayoutTest extends TestCase
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

    public function test_a_driver_reads_his_balance_his_history_and_what_is_payable(): void
    {
        $driver = $this->driver();
        $this->completedRide($driver, 10_000);

        $response = $this->actingAs($this->userOf($driver))
            ->getJson('/api/v1/driver/earnings')
            ->assertOk();

        // 10 000 encaissés moins 10 % de commission.
        $response->assertJsonPath('balance.amount', 9_000);
        $response->assertJsonPath('minimum.amount', RidePayoutTerms::DEFAULT_MINIMUM_AMOUNT);
        $response->assertJsonPath('delay_hours', RidePayoutTerms::DEFAULT_DELAY_HOURS);

        // Deux écritures : le crédit et la commission, séparés. Un net seul
        // transformerait chaque question en réclamation.
        $response->assertJsonCount(2, 'entries');
    }

    /**
     * Le solde et le reversable ne sont pas le même nombre.
     *
     * Une course terminée à l'instant compte au compte courant sans pouvoir
     * partir : les confondre ferait attendre un virement impossible.
     */
    public function test_a_ride_just_finished_counts_in_the_balance_but_is_not_payable(): void
    {
        $driver = $this->driver();
        $this->completedRide($driver, 10_000);

        $this->actingAs($this->userOf($driver))
            ->getJson('/api/v1/driver/earnings')
            ->assertOk()
            ->assertJsonPath('balance.amount', 9_000)
            ->assertJsonPath('payable.amount', 0);
    }

    public function test_nothing_is_built_for_an_unverified_account(): void
    {
        $driver = $this->driver();
        $ride = $this->completedRide($driver, 10_000);
        $this->age($ride);

        // Déclaré mais pas vérifié : une erreur de saisie envoie l'argent à un
        // inconnu, sans recours.
        $this->declareAccount($driver);

        $result = app(BuildDriverPayout::class)->handle($this->payeeOf($driver));

        $this->assertNull($result['payout']);
        $this->assertSame('NO_VERIFIED_ACCOUNT', $result['reason']);
        $this->assertSame(9_000, $result['balance']);
    }

    public function test_a_verified_account_gets_a_payout_proposed_for_validation(): void
    {
        $driver = $this->driver();
        $ride = $this->completedRide($driver, 10_000);
        $this->age($ride);

        $account = $this->declareAccount($driver);
        app(ManagePayoutAccount::class)->verify($account, User::factory()->create()->id);

        $result = app(BuildDriverPayout::class)->handle($this->payeeOf($driver));

        $payout = $result['payout'];

        $this->assertNotNull($payout);
        $this->assertSame(9_000, (int) $payout->net_amount);
        $this->assertSame(10_000, (int) $payout->gross_amount);
        $this->assertSame(1_000, (int) $payout->commission_amount);

        // Aucune agence : c'est tout l'objet du bénéficiaire généralisé.
        $this->assertNull($payout->agency_id);

        // Le relevé descend jusqu'à la course, faute de quoi un net contesté ne
        // s'explique pas.
        $this->assertSame(1, $payout->lines()->count());
        $this->assertSame($ride->id, (int) $payout->lines()->firstOrFail()->ride_id);

        // Proposé, pas versé : le calcul est automatique, le décaissement humain.
        $this->assertSame('PENDING_VALIDATION', $payout->status->value);
    }

    public function test_a_balance_below_the_minimum_waits(): void
    {
        $driver = $this->driver();
        $ride = $this->completedRide($driver, 2_000);
        $this->age($ride);

        $account = $this->declareAccount($driver);
        app(ManagePayoutAccount::class)->verify($account, User::factory()->create()->id);

        $result = app(BuildDriverPayout::class)->handle($this->payeeOf($driver));

        // 1 800 F net : verser si peu coûterait plus de frais qu'il n'en rapporte.
        $this->assertNull($result['payout']);
        $this->assertSame('BELOW_MINIMUM', $result['reason']);
        $this->assertSame(1_800, $result['balance']);
    }

    /**
     * Un reversement en vol emporte un solde qui n'est pas encore soldé : en
     * construire un second le compterait deux fois.
     */
    public function test_a_payout_in_flight_blocks_a_second_one(): void
    {
        $driver = $this->driver();
        $ride = $this->completedRide($driver, 10_000);
        $this->age($ride);

        $account = $this->declareAccount($driver);
        app(ManagePayoutAccount::class)->verify($account, User::factory()->create()->id);

        $payee = $this->payeeOf($driver);
        $this->assertNotNull(app(BuildDriverPayout::class)->handle($payee)['payout']);

        // La forme entiere plutot que trois assertions : c'est le refus complet
        // qui compte, et un solde qui reapparaitrait a cote du refus serait
        // exactement le bogue que ce test cherche.
        $this->assertSame(
            ['payout' => null, 'reason' => 'PAYOUT_IN_FLIGHT', 'balance' => 0],
            app(BuildDriverPayout::class)->handle($payee),
        );
    }

    /**
     * Le numéro complet ne circule jamais, même vers son propriétaire : une
     * réponse d'API finit dans un journal ou un cache.
     */
    public function test_the_account_number_is_masked_in_the_response(): void
    {
        $driver = $this->driver();

        $this->actingAs($this->userOf($driver))
            ->postJson('/api/v1/driver/payout-accounts', [
                'type' => 'MOBILE_MONEY',
                'operator' => 'MTN',
                'account_number' => '+237650112233',
                'account_name' => 'Jean Kamdem',
            ])
            ->assertCreated()
            ->assertJsonPath('verified', false)
            ->assertJsonPath('masked_number', str_repeat('•', 10).'233');
    }

    /**
     * Vérifier un compte désactive les précédents **du même bénéficiaire**.
     *
     * La portée passait par `agency_id`, nul pour un chauffeur : en SQL
     * `agency_id = null` ne matche rien, et deux destinations vérifiées auraient
     * coexisté — le reversement prenant la première venue.
     */
    public function test_verifying_an_account_deactivates_the_previous_one(): void
    {
        $driver = $this->driver();

        $first = $this->declareAccount($driver, '+237650000001');
        app(ManagePayoutAccount::class)->verify($first, User::factory()->create()->id);

        $second = $this->declareAccount($driver, '+237650000002');
        app(ManagePayoutAccount::class)->verify($second, User::factory()->create()->id);

        $this->assertFalse((bool) $first->refresh()->is_active);
        $this->assertTrue((bool) $second->refresh()->is_active);
    }

    /**
     * Le compte se déclare avant la première course.
     *
     * Le bénéficiaire n'existe qu'au premier règlement ; exiger qu'il préexiste
     * ferait échouer l'écran sur une situation qui n'a rien de fautive.
     */
    public function test_an_account_can_be_declared_before_the_first_ride(): void
    {
        $driver = $this->driver();

        $this->actingAs($this->userOf($driver))
            ->getJson('/api/v1/driver/earnings')
            ->assertOk()
            ->assertJsonPath('balance.amount', 0)
            ->assertJsonCount(0, 'entries');
    }

    public function test_earnings_are_refused_to_someone_without_a_driver_file(): void
    {
        $this->actingAs(User::factory()->create())
            ->getJson('/api/v1/driver/earnings')
            ->assertNotFound();
    }

    /** Recule la fin de course au-delà du délai de reversement. */
    private function age(Ride $ride): void
    {
        $ride->update([
            'completed_at' => CarbonImmutable::now()
                ->subHours(RidePayoutTerms::DEFAULT_DELAY_HOURS + 1),
        ]);
    }

    private function declareAccount(DriverProfile $driver, string $number = '+237650112233'): PayoutAccount
    {
        return app(ManagePayoutAccount::class)->submitForPayee(
            payee: $this->payeeOf($driver),
            type: 'MOBILE_MONEY',
            operator: 'MTN',
            accountNumber: $number,
            accountName: 'Jean Kamdem',
            submittedBy: null,
        );
    }

    private function payeeOf(DriverProfile $driver): Payee
    {
        return Payee::forUser((int) $driver->user_id);
    }

    /** Une course payée, conduite et terminée — donc réglée au grand livre. */
    private function completedRide(DriverProfile $driver, int $price): Ride
    {
        $passenger = User::factory()->create();

        $service = app(OpenServiceRequest::class)->handle($passenger, [
            'origin_city_id' => $this->origin->id,
            'origin_landmark' => 'Carrefour Total',
            'destination_city_id' => $this->destination->id,
            'destination_landmark' => null,
            'passengers' => 2,
            'note' => null,
        ]);

        $offer = app(MakeOffer::class)->handle($service, $driver, $price, 15);
        $ride = app(AcceptOffer::class)->handle($offer);

        app(PayForRide::class)->handle(
            $ride,
            PaymentMethod::MobileMoney,
            'MTN',
            '+237690000001',
            'cle-'.$ride->reference,
        );

        // Le pilote factice n'encaisse jamais de façon synchrone : on confirme.
        Payment::query()->where('ride_id', $ride->id)->update([
            'status' => PaymentStatus::Succeeded->value,
            'paid_at' => now(),
        ]);

        $advance = app(AdvanceRide::class);

        return $advance->complete($advance->start($ride->refresh()))->refresh();
    }

    private function userOf(DriverProfile $driver): User
    {
        $user = $driver->user;

        if ($user === null) {
            self::fail('Le dossier de chauffeur doit porter son utilisateur.');
        }

        return $user;
    }

    private function driver(): DriverProfile
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
        ]);

        return $profile->load('user');
    }
}
