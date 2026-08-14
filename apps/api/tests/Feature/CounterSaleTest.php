<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Bookings\Actions\CreateBooking;
use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Data\NewPassenger;
use App\Modules\Bookings\Enums\BookingChannel;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Fleet\Models\VehicleSeat;
use App\Modules\Identity\Enums\Role as RoleEnum;
use App\Modules\Identity\Models\Role;
use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Commission;
use App\Modules\Tickets\Models\Ticket;
use App\Modules\Trips\Models\Trip;
use Carbon\CarbonImmutable;
use Database\Seeders\CountrySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Support\BuildsSearchFixtures;
use Tests\TestCase;

/**
 * Vente au comptoir (I2).
 *
 * **Ce chantier porte l'intégrité de toute la disponibilité affichée.** Une
 * agence qui vend vingt places sans les saisir fait se déplacer des passagers
 * pour rien — et la seule chose qui garantit la saisie, c'est qu'elle soit plus
 * rapide que le cahier. D'où l'appel unique que vérifie ce test.
 */
final class CounterSaleTest extends TestCase
{
    use BuildsSearchFixtures;
    use RefreshDatabase;

    private Agency $agency;

    private User $agent;

    private Trip $trip;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(CountrySeeder::class);
        $this->seed(RoleAndPermissionSeeder::class);
        $this->buildNetwork();

        $this->trip = Trip::query()->where('reference', 'TR-SEATED')->firstOrFail();

        // Le fixture partagé date le départ d'aujourd'hui 8 h, souvent déjà
        // passé à l'heure où tourne la suite. La vente en ligne ne le voyait pas
        // — elle ne regarde que `online_sales_close_at` — mais le guichet, lui,
        // reste ouvert jusqu'au départ et refuse un véhicule parti.
        $this->trip->update(['departure_at' => CarbonImmutable::now()->addHours(6)]);

        $this->agency = $this->trip->agency()->firstOrFail();
        $this->agent = $this->agentOf($this->agency);
    }

    public function test_one_call_sells_confirms_cashes_and_issues_the_tickets(): void
    {
        $response = $this->sell($this->seatIds(2), passengers: 2)->assertCreated();

        $booking = Booking::query()->where('reference', $response->json('booking.reference'))->firstOrFail();

        // Aucune tenue, aucun tunnel de paiement : l'argent est déjà dans la
        // caisse, la place est vendue et non réservée.
        $this->assertSame(BookingChannel::Counter, $booking->channel);
        $this->assertSame(BookingStatus::Confirmed, $booking->status);
        $this->assertNotNull($booking->confirmed_at);
        $this->assertNull($booking->expires_at);

        // Le passager n'a pas de compte — ni inscription ni OTP —, mais on sait
        // quel agent a encaissé, sans quoi la caisse ne se réconcilie pas.
        $this->assertNull($booking->user_id);
        $this->assertSame($this->agent->id, $booking->created_by);

        $payment = Payment::query()->where('booking_id', $booking->id)->firstOrFail();
        $this->assertSame(PaymentMethod::Cash, $payment->method);
        $this->assertSame($booking->total_amount, $payment->amount);
        $this->assertNotNull($payment->paid_at);

        // Les billets partent tout de suite : le passager repart avec.
        $this->assertCount(2, $response->json('ticket_references'));
        $this->assertSame(2, Ticket::query()->where('booking_id', $booking->id)->count());
        $this->assertSame($booking->total_amount, $response->json('amount_due.amount'));
    }

    /**
     * Le flux d'argent d'une vente guichet est l'inverse de celui d'une vente en
     * ligne, et c'est le point le plus facile à se tromper.
     */
    public function test_the_agency_is_never_credited_for_money_it_collected_itself(): void
    {
        $this->sell($this->seatIds(1))->assertCreated();

        // Créditer le compte courant puis reverser reviendrait à payer une
        // seconde fois à l'agence ce qu'elle a déjà dans sa caisse.
        $this->assertSame(0, AgencyLedgerEntry::query()->count());
        $this->assertSame(0, Commission::query()->count());
    }

    public function test_an_activated_commission_produces_a_debit_and_only_a_debit(): void
    {
        // Désactivée par défaut (B4) : le guichet est le canal de l'agence, pas
        // celui de la plateforme.
        $this->agency->commercialTerms()->update(['counter_sale_commission_enabled' => true]);

        $this->sell($this->seatIds(1))->assertCreated();

        $booking = Booking::query()->where('channel', BookingChannel::Counter->value)->firstOrFail();
        $commission = Commission::query()->where('booking_id', $booking->id)->firstOrFail();

        $this->assertSame(intdiv($booking->total_amount * 800, 10000), $commission->amount);

        $this->assertSame(1, AgencyLedgerEntry::query()->count());

        $entry = AgencyLedgerEntry::query()->firstOrFail();
        $this->assertSame('COUNTER_COMMISSION_DEBIT', $entry->type);

        // C'est l'agence qui **doit** cette commission à MOTOBOY : un débit seul,
        // déduit de son prochain reversement.
        $this->assertSame(-$commission->amount, (int) $entry->amount);
    }

    public function test_the_sms_can_be_switched_off_per_agency(): void
    {
        $this->sell($this->seatIds(1))->assertCreated()->assertJsonPath('sms_sent', true);
        $this->assertSame(1, Notification::query()->where('type', 'COUNTER_TICKET')->count());

        // C'est le seul cas où la plateforme paierait un SMS sur une vente ne
        // portant aucune commission : à volume élevé la fuite devient nette,
        // d'où l'interrupteur — le levier doit exister avant d'en avoir besoin.
        $this->agency->commercialTerms()->update(['counter_sale_sms_enabled' => false]);

        $this->sell($this->seatIds(1, skip: 1))->assertCreated()->assertJsonPath('sms_sent', false);
        $this->assertSame(1, Notification::query()->where('type', 'COUNTER_TICKET')->count());
    }

    public function test_the_counter_stays_open_after_online_sales_close(): void
    {
        // La vente en ligne ferme trente minutes avant le départ ; l'agence, elle,
        // voit le véhicule et maîtrise sa situation (B2).
        $this->trip->update([
            'departure_at' => CarbonImmutable::now()->addMinutes(5),
            'online_sales_close_at' => CarbonImmutable::now()->subMinute(),
        ]);

        $this->sell($this->seatIds(1))->assertCreated();
    }

    public function test_a_departed_trip_sells_nothing(): void
    {
        $this->trip->update(['departure_at' => CarbonImmutable::now()->subMinute()]);

        $this->sell($this->seatIds(1))
            ->assertStatus(409)
            ->assertJsonPath('code', 'ONLINE_SALES_CLOSED');
    }

    /**
     * Le hold l'emporte sur le guichet : donner la priorité au comptoir
     * obligerait à rembourser un passager venant de payer avec succès (B2).
     */
    public function test_a_seat_held_by_an_online_payment_is_refused_at_the_counter(): void
    {
        $seat = $this->seatIds(1)[0];
        $this->hold($seat);

        $this->sell([$seat])
            ->assertStatus(409)
            ->assertJsonPath('code', 'SEAT_ALREADY_HELD');
    }

    public function test_the_counter_seat_map_tells_held_from_sold(): void
    {
        $seats = $this->seatIds(2);
        $this->hold($seats[0]);
        $this->sell([$seats[1]])->assertCreated();

        $map = $this->actingAs($this->agent)
            ->getJson("/api/v1/agency/trips/{$this->trip->reference}/seats")
            ->assertOk()
            ->json();

        $byId = $this->byId($map['seats']);

        // L'agent doit distinguer « vendue » de « tenue, se libère dans six
        // minutes » pour savoir s'il attend ou s'il oriente son client.
        $this->assertSame('HELD', $byId[$seats[0]]['status']);
        $this->assertNotNull($byId[$seats[0]]['held_until']);

        $this->assertSame('TAKEN', $byId[$seats[1]]['status']);
        $this->assertNull($byId[$seats[1]]['held_until']);

        $this->assertSame($this->trip->capacity - 2, $map['seats_available']);
    }

    public function test_the_public_seat_map_never_exposes_the_deadline(): void
    {
        $seat = $this->seatIds(1)[0];
        $this->hold($seat);

        $seats = $this->byId(
            $this->getJson("/api/v1/trips/{$this->trip->reference}/seats")->assertOk()->json('seats')
        );

        // L'échéance ne sert à rien au passager — il ne peut pas décider
        // d'attendre à la place de quelqu'un — et exposerait le rythme des
        // ventes d'une agence à ses concurrents.
        $this->assertSame('HELD', $seats[$seat]['status']);
        $this->assertArrayNotHasKey('held_until', $seats[$seat]);
    }

    public function test_a_replayed_request_sells_the_seats_only_once(): void
    {
        $seat = $this->seatIds(1);

        $first = $this->sell($seat, key: 'guichet-1')->assertCreated();
        $second = $this->sell($seat, key: 'guichet-1')->assertCreated();

        // La tablette d'un agent sur le wifi d'une gare n'est pas plus fiable
        // qu'un téléphone de passager : sans clé, la requête rejouée produirait
        // une seconde vente et un second encaissement à réconcilier.
        $this->assertSame($first->json('booking.reference'), $second->json('booking.reference'));
        $this->assertSame(1, Booking::query()->count());
        $this->assertSame(1, Payment::query()->count());
        $this->assertSame(1, Ticket::query()->count());
    }

    public function test_an_agency_sells_nothing_on_another_agency_departure(): void
    {
        $other = Trip::query()->where('reference', 'TR-CAPACITY')->firstOrFail();

        // `NOT_FOUND` et non « interdit » : confirmer l'existence du départ
        // permettrait d'énumérer le plan de charge d'un concurrent.
        $this->actingAs($this->agent)
            ->withHeader('Idempotency-Key', 'guichet-adverse')
            ->postJson('/api/v1/agency/counter-sales', [
                'trip_reference' => $other->reference,
                'passengers' => [['first_name' => 'Awa', 'last_name' => 'Nkeng']],
                'contact_phone' => '+237690000001',
            ])
            ->assertStatus(404)
            ->assertJsonPath('code', 'NOT_FOUND');
    }

    /**
     * L'agence annule ce qu'elle a vendu au comptoir : ce passager n'a pas de
     * compte et ne peut rien annuler lui-même. Sans cette route, son siège
     * resterait bloqué jusqu'au départ, indisponible pour tout le monde.
     */
    public function test_the_agency_cancels_a_counter_sale_and_hands_the_cash_back_itself(): void
    {
        $this->agency->commercialTerms()->update(['counter_sale_commission_enabled' => true]);

        $seat = $this->seatIds(1)[0];
        $reference = $this->sell([$seat])->assertCreated()->json('booking.reference');

        $response = $this->actingAs($this->agent)
            ->postJson("/api/v1/agency/bookings/{$reference}/cancel")
            ->assertOk();

        // Aucun remboursement par la plateforme : l'argent n'y est jamais passé,
        // l'agence rend les espèces de la main à la main.
        $this->assertNull($response->json('refund'));
        $this->assertSame(0, $response->json('refunded.amount'));
        $this->assertSame(0, Refund::query()->count());

        $booking = Booking::query()->where('reference', $reference)->firstOrFail();
        $this->assertSame(BookingStatus::CancelledByPassenger, $booking->status);

        // La commission guichet portait sur un transport qui n'aura pas lieu.
        $reversal = AgencyLedgerEntry::query()->where('type', 'COUNTER_COMMISSION_REVERSAL')->firstOrFail();
        $this->assertSame(0, (int) AgencyLedgerEntry::query()->sum('amount'));
        $this->assertGreaterThan(0, (int) $reversal->amount);

        // Et le siège repart à la vente.
        $this->sell([$seat])->assertCreated();
    }

    public function test_the_key_is_required(): void
    {
        $this->actingAs($this->agent)
            ->postJson('/api/v1/agency/counter-sales', [
                'trip_reference' => $this->trip->reference,
                'passengers' => [['first_name' => 'Awa', 'last_name' => 'Nkeng']],
                'contact_phone' => '+237690000001',
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_FAILED');
    }

    /**
     * @param  list<int>  $seatIds
     * @return TestResponse<JsonResponse>
     */
    private function sell(array $seatIds, int $passengers = 1, ?string $key = null): TestResponse
    {
        $rows = [];

        for ($index = 0; $index < $passengers; $index++) {
            $rows[] = [
                'first_name' => 'Passager'.$index,
                'last_name' => 'Guichet',
                'seat_id' => $seatIds[$index] ?? null,
            ];
        }

        return $this->actingAs($this->agent)
            ->withHeader('Idempotency-Key', $key ?? 'guichet-'.bin2hex(random_bytes(4)))
            ->postJson('/api/v1/agency/counter-sales', [
                'trip_reference' => $this->trip->reference,
                'passengers' => $rows,
                'contact_phone' => '+237690000001',
                'contact_name' => 'Awa Nkeng',
            ]);
    }

    /** Une réservation en ligne en attente de paiement, qui tient sa place. */
    private function hold(int $seatId): Booking
    {
        return (new CreateBooking)->handle(new NewBooking(
            tripReference: $this->trip->reference,
            passengers: [new NewPassenger('En', 'Ligne', null, $seatId)],
            idempotencyKey: 'hold-'.bin2hex(random_bytes(4)),
            userId: User::factory()->create()->id,
        ));
    }

    /** @return list<int> */
    private function seatIds(int $count, int $skip = 0): array
    {
        $ids = VehicleSeat::query()
            ->where('vehicle_id', $this->trip->vehicle_id)
            ->orderBy('id')
            ->skip($skip)
            ->take($count)
            ->pluck('id')
            ->all();

        return array_values(array_map(intval(...), $ids));
    }

    /**
     * Indexe un plan de sièges par identifiant : l'ordre d'affichage suit les
     * rangées, et s'appuyer dessus rendrait le test faux au premier véhicule
     * dont la numérotation change.
     *
     * @return array<int, array<string, mixed>>
     */
    private function byId(mixed $seats): array
    {
        $indexed = [];

        foreach ((array) $seats as $seat) {
            $row = (array) $seat;
            $indexed[(int) $row['id']] = $row;
        }

        return $indexed;
    }

    private function agentOf(Agency $agency): User
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
