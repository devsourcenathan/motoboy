<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Identity\Models\User;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payouts\Enums\LedgerEntryType;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Payee;
use App\Modules\Places\Models\City;
use App\Modules\Rides\Actions\AcceptOffer;
use App\Modules\Rides\Actions\AdvanceRide;
use App\Modules\Rides\Actions\CancelServiceRequest;
use App\Modules\Rides\Actions\MakeOffer;
use App\Modules\Rides\Actions\OpenServiceRequest;
use App\Modules\Rides\Actions\PayForRide;
use App\Modules\Rides\Actions\RecordRideSettlement;
use App\Modules\Rides\Actions\RefundRide;
use App\Modules\Rides\Enums\DriverStatus;
use App\Modules\Rides\Enums\RideStatus;
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
 * L'argent d'une course, du paiement au grand livre (E4 bis).
 *
 * C'est ici que le bénéficiaire généralisé de l'étape 1 sert : le grand livre
 * écrit pour une **personne**, sans savoir que ce n'est pas une agence.
 */
final class RideSettlementTest extends TestCase
{
    use RefreshDatabase;

    private City $city;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(CountrySeeder::class);
        $this->seed(CitySeeder::class);

        $this->city = City::query()->firstOrFail();
    }

    public function test_a_completed_and_paid_ride_credits_the_driver_minus_commission(): void
    {
        $ride = $this->ride();
        $this->pay($ride);

        $this->complete($ride);

        $payee = Payee::query()->where('user_id', $ride->driver?->user_id)->firstOrFail();
        $entries = AgencyLedgerEntry::query()->where('payee_id', $payee->id)->get();

        $this->assertCount(2, $entries);

        // Crédit et débit séparés : le chauffeur doit lire ce qu'il a gagné et
        // ce qui a été prélevé, pas seulement un net.
        $this->assertSame(
            10_000,
            $entries->firstWhere('type', LedgerEntryType::RideCredit)?->amount,
        );
        $this->assertSame(
            -1_000,
            $entries->firstWhere('type', LedgerEntryType::CommissionDebit)?->amount,
        );

        // Le solde est la somme des écritures : 10 % de commission sur 10 000.
        $this->assertSame(9_000, (int) $entries->sum('amount'));

        // L'écriture n'a aucune agence : c'est ce que le bénéficiaire permet.
        $this->assertNull($entries->first()?->agency_id);
    }

    /**
     * L'erreur la plus chère du module : créditer un chauffeur pour un argent
     * que la plateforme n'a jamais encaissé.
     *
     * **L'état est construit à la main, faute de chemin qui y mène.** Depuis que
     * `start()` refuse une course impayée, cette course ne peut plus exister par
     * l'API. La garde du règlement reste pourtant nécessaire : c'est la deuxième
     * ligne, et la première tomberait sans bruit le jour où une reprise manuelle
     * ou une future transition passerait à côté.
     */
    public function test_an_unpaid_ride_credits_nothing(): void
    {
        $ride = $this->ride();

        $ride->update([
            'status' => RideStatus::Completed,
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        app(RecordRideSettlement::class)->handle($ride->refresh());

        $this->assertSame(0, AgencyLedgerEntry::query()->count());
    }

    /**
     * Et la première ligne : une course impayée ne démarre pas.
     *
     * Tout se règle à l'acceptation (E4 bis). Sans cette garde, une course
     * entière pouvait se dérouler sans qu'un franc ait bougé — l'écran du
     * chauffeur grisait le bouton, mais une règle d'argent tenue par une
     * interface n'est pas tenue.
     */
    public function test_an_unpaid_ride_cannot_start(): void
    {
        $ride = $this->ride();

        $this->expectException(ApiException::class);

        app(AdvanceRide::class)->start($ride);
    }

    /**
     * Terminer deux fois — un appareil qui réémet, une reprise manuelle — ne doit
     * pas créditer deux fois.
     */
    public function test_settling_twice_credits_once(): void
    {
        $ride = $this->ride();
        $this->pay($ride);
        $this->complete($ride);

        app(RecordRideSettlement::class)->handle($ride->refresh());

        $this->assertSame(2, AgencyLedgerEntry::query()->count());
    }

    /**
     * Le prix se règle à l'acceptation, pas une fois la course lancée.
     *
     * L'état est posé directement plutôt qu'atteint par `start()` : y passer
     * exigerait de payer d'abord, et la tentative suivante buterait alors sur
     * « déjà payée ». Le test passerait, mais pour une autre raison que celle
     * qu'il prétend vérifier.
     */
    public function test_a_started_ride_can_no_longer_be_paid(): void
    {
        $ride = $this->ride();
        $ride->update(['status' => RideStatus::InProgress, 'started_at' => now()]);

        $this->expectException(ApiException::class);

        $this->pay($ride->refresh());
    }

    /**
     * Le téléphone perd le réseau juste après l'envoi et réessaie : sans rejeu,
     * le passager paierait deux fois la même course.
     */
    public function test_the_same_key_pays_once(): void
    {
        $ride = $this->ride();

        $first = $this->pay($ride, 'cle-unique');
        $second = $this->pay($ride->refresh(), 'cle-unique');

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, Payment::query()->where('ride_id', $ride->id)->count());
    }

    /**
     * Annuler avant le depart rend tout : le chauffeur n'a rien engage.
     */
    public function test_cancelling_before_departure_refunds_in_full(): void
    {
        $ride = $this->ride();
        $this->pay($ride);
        $this->settle($ride);

        $this->cancel($ride, 'Changement de plan');

        $this->assertSame(10_000, (int) Refund::query()->sum('amount'));
        $this->assertSame(0, (int) Refund::query()->sum('fee_amount'));
    }

    /**
     * Une fois la course demarree, rien n'est rendu : le chauffeur a roule.
     */
    public function test_cancelling_after_departure_refunds_nothing(): void
    {
        $ride = $this->ride();
        $this->pay($ride);
        $this->settle($ride);
        app(AdvanceRide::class)->start($ride->refresh());

        $this->cancel($ride, 'Trop tard');

        $this->assertSame(0, Refund::query()->count());
    }

    /**
     * L'absence rend tout **et** compte. Une marque qui ne s'accumule pas ne
     * justifierait jamais une suspension.
     */
    public function test_a_no_show_refunds_in_full_and_marks_the_driver(): void
    {
        $ride = $this->ride();
        $this->pay($ride);
        $this->settle($ride);

        app(RefundRide::class)->onDriverNoShow($ride->refresh());

        $this->assertSame(10_000, (int) Refund::query()->sum('amount'));
        $this->assertSame(1, $ride->driver?->refresh()->no_show_count);
    }

    /**
     * Resout la demande et son passager explicitement.
     *
     * Passer par les relations donnerait des types nullables, et l'analyse
     * statique a raison de le refuser : une course sans demande serait un
     * invariant casse, pas un cas a gerer.
     */
    private function cancel(Ride $ride, string $reason): void
    {
        $service = ServiceRequest::query()->findOrFail($ride->service_request_id);
        $passenger = User::query()->findOrFail($service->user_id);

        app(CancelServiceRequest::class)->handle($service, $passenger, $reason);
    }

    /** Marque le paiement abouti sans avancer la course. */
    private function settle(Ride $ride): void
    {
        Payment::query()->where('ride_id', $ride->id)->update([
            'status' => PaymentStatus::Succeeded->value,
            'paid_at' => now(),
        ]);
    }

    private function pay(Ride $ride, string $key = 'cle-de-course'): Payment
    {
        return app(PayForRide::class)->handle(
            $ride,
            PaymentMethod::MobileMoney,
            'MTN',
            '+237690000001',
            $key,
        );
    }

    /** Le pilote factice n'encaisse jamais de façon synchrone : on confirme. */
    private function complete(Ride $ride): void
    {
        Payment::query()->where('ride_id', $ride->id)->update([
            'status' => PaymentStatus::Succeeded->value,
            'paid_at' => now(),
        ]);

        $advance = app(AdvanceRide::class);
        $advance->complete($advance->start($ride->refresh()));
    }

    private function ride(): Ride
    {
        $passenger = User::factory()->create();

        $request = app(OpenServiceRequest::class)->handle($passenger, [
            'origin_city_id' => $this->city->id,
            'origin_landmark' => 'Carrefour Total',
            'destination_city_id' => $this->city->id,
            'destination_landmark' => null,
            'passengers' => 1,
        ]);

        $driver = DriverProfile::query()->create([
            'user_id' => User::factory()->create()->id,
            'status' => DriverStatus::Approved,
            'license_number' => 'CM-'.fake()->unique()->numerify('######'),
            'license_expires_at' => CarbonImmutable::now()->addYear(),
            'vehicle_plate' => fake()->unique()->bothify('LT-###-??'),
            'vehicle_type' => VehicleType::Car,
            'vehicle_seats' => 4,
            'city_id' => $this->city->id,
        ]);

        $offer = app(MakeOffer::class)->handle($request, $driver, 10_000, 15);

        return app(AcceptOffer::class)->handle($offer)->load('driver');
    }
}
