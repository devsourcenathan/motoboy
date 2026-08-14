<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Bookings\Models\BookingPassenger;
use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Fleet\Models\Vehicle;
use App\Modules\Identity\Enums\Locale;
use App\Modules\Identity\Models\User;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Models\Payment;
use App\Modules\Places\Models\City;
use App\Modules\Places\Models\Country;
use App\Modules\Places\Models\Station;
use App\Modules\Routing\Models\Route;
use App\Modules\Trips\Models\Trip;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Exerce les modèles contre le **vrai schéma**.
 *
 * L'analyse statique ne prouve rien ici : elle valide des types, pas qu'une
 * relation résout, qu'un cast fait l'aller-retour, ou qu'un nom de colonne
 * existe. Un modèle qui passe PHPStan et casse à la première requête est le
 * scénario que ce test ferme.
 */
final class ModelGraphTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_domain_graph_resolves_end_to_end(): void
    {
        $booking = $this->makeBooking();

        $trip = $booking->trip;
        $this->assertNotNull($trip);

        $this->assertSame('Général Express', $booking->agency?->name);
        $this->assertSame('Douala', $trip->originCity?->name);
        $this->assertSame('Bamenda', $trip->destinationCity?->name);
        $this->assertSame('Gare Bonabéri', $trip->originStation?->name);
        $this->assertSame('Douala', $trip->originStation->city?->name);
        $this->assertSame('LT-001-AB', $trip->vehicle?->registration);
        $this->assertCount(1, $booking->passengers);
        $this->assertSame('A1', $booking->passengers->first()?->seat?->label);
    }

    public function test_enums_survive_the_round_trip(): void
    {
        $booking = $this->makeBooking()->fresh();
        $this->assertNotNull($booking);

        $trip = $booking->trip;
        $this->assertNotNull($trip);

        $this->assertSame(BookingStatus::PendingPayment, $booking->status);
        $this->assertSame(SeatingMode::Seated, $trip->seating_mode);
        $this->assertSame(VehicleType::Bus, $trip->vehicle?->type);
        $this->assertSame(Locale::French, $booking->agency?->default_locale);
    }

    public function test_dates_come_back_immutable(): void
    {
        $booking = $this->makeBooking()->fresh();
        $this->assertNotNull($booking);

        $trip = $booking->trip;
        $this->assertNotNull($trip);

        // Un `->subMinutes()` sur une date mutable modifierait l'attribut du
        // modèle en place. Ce projet fait beaucoup d'arithmétique de dates sur
        // des attributs — fermeture des ventes, expiration de la tenue,
        // éligibilité au reversement — donc l'immuabilité n'est pas cosmétique.
        $this->assertInstanceOf(CarbonImmutable::class, $booking->expires_at);
        $this->assertInstanceOf(CarbonImmutable::class, $trip->departure_at);

        $before = $trip->departure_at;
        $trip->departure_at->subMinutes(30);

        $this->assertEquals($before, $trip->departure_at);
    }

    public function test_a_booking_carries_several_payment_attempts(): void
    {
        $booking = $this->makeBooking();

        foreach ([PaymentStatus::Failed, PaymentStatus::Failed, PaymentStatus::Succeeded] as $index => $status) {
            Payment::create([
                'reference' => "PM-{$index}",
                'booking_id' => $booking->id,
                'amount' => 9000,
                'currency' => 'XAF',
                'method' => PaymentMethod::MobileMoney,
                'idempotency_key' => "key-{$index}",
                'status' => $status,
            ]);
        }

        // Avec Mobile Money l'échec est banal — code erroné, solde insuffisant.
        // Réessayer est le cas nominal, et la réservation reste ouverte (B2).
        $this->assertCount(3, $booking->payments()->get());
        $this->assertSame(PaymentStatus::Succeeded, $booking->successfulPayment()->first()?->status);
    }

    public function test_the_expired_holds_scope_finds_what_the_release_job_must_free(): void
    {
        $booking = $this->makeBooking();

        $this->assertCount(0, Booking::expiredHolds()->get());

        $booking->update(['expires_at' => now()->subMinute()]);

        $this->assertCount(1, Booking::expiredHolds()->get());

        // Une réservation confirmée n'est jamais libérée, même si `expires_at`
        // est dans le passé.
        $booking->update(['status' => BookingStatus::Confirmed]);

        $this->assertCount(0, Booking::expiredHolds()->get());
    }

    private function makeBooking(): Booking
    {
        $country = Country::create([
            'code' => 'CM', 'name' => 'Cameroun', 'currency' => 'XAF',
            'phone_prefix' => '+237', 'timezone' => 'Africa/Douala',
        ]);

        $douala = City::create(['country_id' => $country->id, 'name' => 'Douala', 'slug' => 'douala']);
        $bamenda = City::create(['country_id' => $country->id, 'name' => 'Bamenda', 'slug' => 'bamenda']);

        $agency = Agency::create([
            'reference' => 'AG-1', 'name' => 'Général Express',
            'phone' => '+237690000100', 'default_locale' => Locale::French, 'status' => 'APPROVED',
        ]);

        $from = Station::create(['agency_id' => $agency->id, 'city_id' => $douala->id, 'name' => 'Gare Bonabéri']);
        $to = Station::create(['agency_id' => $agency->id, 'city_id' => $bamenda->id, 'name' => 'Gare Bamenda']);

        $vehicle = Vehicle::create([
            'agency_id' => $agency->id, 'registration' => 'LT-001-AB',
            'type' => VehicleType::Bus, 'seating_mode' => SeatingMode::Seated, 'capacity' => 4,
        ]);

        $seat = $vehicle->seats()->create([
            'label' => 'A1', 'row_index' => 1, 'column_index' => 1,
        ]);

        $route = Route::create([
            'agency_id' => $agency->id,
            'origin_city_id' => $douala->id, 'destination_city_id' => $bamenda->id,
            'origin_station_id' => $from->id, 'destination_station_id' => $to->id,
            'reference_duration_minutes' => 420,
        ]);

        $departure = CarbonImmutable::now()->addDay();

        $trip = Trip::create([
            'reference' => 'TR-1', 'agency_id' => $agency->id, 'route_id' => $route->id,
            'origin_city_id' => $douala->id, 'destination_city_id' => $bamenda->id,
            'origin_station_id' => $from->id, 'destination_station_id' => $to->id,
            'departure_at' => $departure,
            'online_sales_close_at' => $departure->subMinutes(30),
            'vehicle_id' => $vehicle->id, 'price' => 9000, 'currency' => 'XAF',
            'seating_mode' => SeatingMode::Seated, 'capacity' => 4, 'status' => 'SCHEDULED',
        ]);

        $user = User::factory()->create();

        $booking = Booking::create([
            'reference' => 'MTB-1', 'trip_id' => $trip->id, 'agency_id' => $agency->id,
            'user_id' => $user->id, 'channel' => 'ONLINE',
            'status' => BookingStatus::PendingPayment,
            'expires_at' => now()->addMinutes(10),
            'seats_count' => 1, 'total_amount' => 9000, 'currency' => 'XAF',
            // Conditions figées à la création, recopiées depuis les conditions
            // commerciales de l'agence (B4).
            'commission_type' => 'PERCENTAGE', 'commission_value' => 800, 'fee_bearer' => 'PLATFORM',
            'cancellation_deadline_hours' => 2,
            'cancellation_fee_type' => 'PERCENTAGE', 'cancellation_fee_value' => 2000,
        ]);

        BookingPassenger::create([
            'booking_id' => $booking->id, 'trip_id' => $trip->id, 'seat_id' => $seat->id,
            'holds_seat' => true, 'first_name' => 'Awa', 'last_name' => 'Nkeng',
        ]);

        return $booking;
    }
}
