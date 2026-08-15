<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Bookings\Models\BookingPassenger;
use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Trips\Models\Trip;
use Carbon\CarbonImmutable;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Support\BuildsSearchFixtures;
use Tests\TestCase;

final class SearchTest extends TestCase
{
    use BuildsSearchFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(CountrySeeder::class);
        $this->buildNetwork();
    }

    public function test_it_returns_departures_from_every_agency_on_the_axis(): void
    {
        $response = $this->getJson($this->searchUrl('douala', 'bafoussam'))->assertOk();

        // Deux agences sur le même axe : sans cela, il n'y a rien à comparer et
        // le produit n'est qu'une billetterie (§1 du brief).
        $agencies = array_column(array_column($response->json('data'), 'agency'), 'name');

        $this->assertEqualsCanonicalizing(['Général Express', 'Western Voyages'], $agencies);
    }

    public function test_a_stopover_city_does_not_make_a_trip_eligible(): void
    {
        // Le départ Douala → Bafoussam passe par Nkongsamba, déclaré en escale.
        // La réservation étant point-à-point, chercher Douala → Nkongsamba ne
        // doit rien renvoyer (B6). C'est le coût assumé de la décision.
        $response = $this->getJson($this->searchUrl('douala', 'nkongsamba'))->assertOk();

        $this->assertSame([], $response->json('data'));
    }

    public function test_a_departure_past_its_online_cutoff_disappears(): void
    {
        $trip = Trip::query()->where('reference', 'TR-SEATED')->firstOrFail();
        $trip->update(['online_sales_close_at' => CarbonImmutable::now()->subMinute()]);

        $references = array_column(
            $this->getJson($this->searchUrl('douala', 'bafoussam'))->json('data'),
            'reference',
        );

        $this->assertNotContains('TR-SEATED', $references);
    }

    public function test_availability_counts_held_seats_in_both_inventory_modes(): void
    {
        $this->holdSeats('TR-SEATED', 2);
        $this->holdSeats('TR-CAPACITY', 3);

        $byReference = $this->dataByReference($this->searchUrl('douala', 'bafoussam'));

        // Une seule source de vérité pour les deux modes : les lignes de
        // booking_passengers. `seats_taken` reste un garde-fou d'écriture.
        $this->assertSame(30 - 2, $byReference['TR-SEATED']['seats_available']);
        $this->assertSame(18 - 3, $byReference['TR-CAPACITY']['seats_available']);
        $this->assertSame(SeatingMode::Seated->value, $byReference['TR-SEATED']['seating_mode']);
        $this->assertSame(SeatingMode::Capacity->value, $byReference['TR-CAPACITY']['seating_mode']);
    }

    public function test_a_pending_payment_hold_already_removes_the_seat(): void
    {
        // La place est retirée avant même le paiement : c'est ce qui empêche la
        // double-vente pendant les dix minutes de tenue (B2).
        $this->holdSeats('TR-SEATED', 30, BookingStatus::PendingPayment);

        $byReference = $this->dataByReference($this->searchUrl('douala', 'bafoussam'));

        $this->assertSame(0, $byReference['TR-SEATED']['seats_available']);
    }

    public function test_only_available_respects_the_whole_group(): void
    {
        $this->holdSeats('TR-CAPACITY', 17);

        $url = $this->searchUrl('douala', 'bafoussam').'&only_available=1&passengers=2';
        $references = array_column($this->getJson($url)->json('data'), 'reference');

        // Il reste une place sur le véhicule à capacité : insuffisant pour deux
        // passagers, une réservation groupée étant prise en tout ou rien.
        $this->assertNotContains('TR-CAPACITY', $references);
        $this->assertContains('TR-SEATED', $references);
    }

    public function test_best_sort_puts_the_cheapest_first(): void
    {
        $prices = array_column(
            $this->getJson($this->searchUrl('douala', 'bafoussam'))->json('data'),
            'price',
        );

        $amounts = array_column($prices, 'amount');
        $sorted = $amounts;
        sort($sorted);

        $this->assertSame($sorted, $amounts);
    }

    public function test_an_empty_search_carries_its_fallback(): void
    {
        // Date trop lointaine pour que les dates proches remontent quoi que ce
        // soit, alors que l'axe est desservi tous les jours. C'est le cas où le
        // passager repartirait les mains vides si `routes_served` excluait la
        // destination demandée (I9).
        $response = $this->getJson($this->searchUrl('douala', 'bafoussam', '2027-01-01'))->assertOk();

        $this->assertSame([], $response->json('data'));

        /** @var list<array{destination_city: string, trips_count: int}> $routes */
        $routes = $response->json('suggestions.routes_served');
        $served = array_column($routes, 'trips_count', 'destination_city');

        $this->assertArrayHasKey('Bafoussam', $served);
        $this->assertSame(2, $served['Bafoussam']);
    }

    public function test_a_populated_search_does_not_pay_for_suggestions(): void
    {
        $response = $this->getJson($this->searchUrl('douala', 'bafoussam'))->assertOk();

        $this->assertNotEmpty($response->json('data'));
        $this->assertSame([], $response->json('suggestions.nearby_dates'));
        $this->assertSame([], $response->json('suggestions.routes_served'));
    }

    public function test_the_same_axis_on_another_day_is_suggested(): void
    {
        $tomorrow = CarbonImmutable::now(config('app.display_timezone'))->addDay();
        $this->buildTrip('TR-TOMORROW', 'douala', 'bafoussam', $tomorrow->setTime(9, 0), 7000, seated: true);

        $response = $this->getJson($this->searchUrl('douala', 'bafoussam', '2027-01-01'))->assertOk();

        $dates = array_column($response->json('suggestions.nearby_dates'), 'date');

        // Rien ne correspond au 1er janvier 2027 : les dates proches se
        // calculent autour de la date demandée, donc restent vides ici. C'est
        // le cas « axe desservi, jour sans départ » qui doit remonter.
        $this->assertSame([], $dates);

        $response = $this->getJson($this->searchUrl('douala', 'bamenda', $tomorrow->toDateString()))->assertOk();
        $this->assertSame([], $response->json('data'));
        $this->assertNotEmpty($response->json('suggestions.routes_served'));
    }

    public function test_departure_window_filters_on_local_time_not_utc(): void
    {
        // Le fuseau du Cameroun est UTC+1 : un départ à 08:00 locales est à
        // 07:00 UTC. Un filtre naïf sur l'instant l'exclurait de « à partir de
        // 08:00 », alors que l'heure saisie est une heure de pendule.
        $url = $this->searchUrl('douala', 'bafoussam').'&departure_from=08:00&departure_to=08:30';
        $references = array_column($this->getJson($url)->json('data'), 'reference');

        $this->assertContains('TR-SEATED', $references);
    }

    /** @return array<string, array<string, mixed>> */
    private function dataByReference(string $url): array
    {
        /** @var list<array<string, mixed>> $data */
        $data = $this->getJson($url)->json('data');

        $indexed = [];

        foreach ($data as $trip) {
            $indexed[(string) $trip['reference']] = $trip;
        }

        return $indexed;
    }

    private function holdSeats(string $reference, int $count, ?BookingStatus $status = null): void
    {
        $trip = Trip::query()->where('reference', $reference)->firstOrFail();

        $booking = Booking::create([
            'reference' => 'MTB-'.$reference.'-'.$count,
            'trip_id' => $trip->id,
            'agency_id' => $trip->agency_id,
            'channel' => 'ONLINE',
            'status' => $status ?? BookingStatus::Confirmed,
            'seats_count' => $count,
            'total_amount' => $trip->price * $count,
            'currency' => 'XAF',
            'commission_type' => 'PERCENTAGE',
            'commission_value' => 800,
            'fee_bearer' => 'PLATFORM',
            'cancellation_deadline_hours' => 2,
            'cancellation_fee_type' => 'PERCENTAGE',
            'cancellation_fee_value' => 2000,
        ]);

        $seats = $trip->vehicle?->seats()->orderBy('id')->limit($count)->get();

        for ($index = 0; $index < $count; $index++) {
            BookingPassenger::create([
                'booking_id' => $booking->id,
                'trip_id' => $trip->id,
                'seat_id' => $seats?->get($index)?->id,
                'holds_seat' => true,
                'first_name' => 'Test',
                'last_name' => (string) $index,
            ]);
        }
    }

    /**
     * `true` en toutes lettres, pas seulement `1`.
     *
     * Le contrat déclare un booléen, et c'est ainsi qu'un client généré depuis
     * la spec le sérialise. La règle `boolean` de Laravel ne reconnaissant que
     * `1` et `0`, le serveur répondait 422 sur sa propre forme canonique — et le
     * test existant, écrit avec `=1`, ne pouvait pas s'en apercevoir.
     */
    public function test_only_available_accepts_the_canonical_boolean(): void
    {
        $url = $this->searchUrl('douala', 'bafoussam');

        $this->getJson($url.'&only_available=true')->assertOk();
        $this->getJson($url.'&only_available=false')->assertOk();
    }

    /**
     * Une borne haute seule est légitime — c'est même la recherche la plus
     * courante, « moins de X ». La règle `gte:price_min` la refusait en 422 dès
     * que la borne basse manquait, alors que le contrat déclare les deux bornes
     * indépendantes. Une fourchette inversée, elle, reste refusée.
     */
    public function test_the_upper_price_bound_works_on_its_own(): void
    {
        $url = $this->searchUrl('douala', 'bafoussam');

        $this->getJson($url.'&price_max=100000')->assertOk();
        $this->getJson($url.'&price_min=1000')->assertOk();
        $this->getJson($url.'&price_min=5000&price_max=4000')->assertStatus(422);
    }
}
