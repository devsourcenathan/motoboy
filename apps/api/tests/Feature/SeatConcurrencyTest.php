<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Bookings\Actions\CreateBooking;
use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Data\NewPassenger;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Fleet\Models\VehicleSeat;
use App\Modules\Identity\Models\User;
use App\Modules\Trips\Models\Trip;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Database\Seeders\CountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Support\BuildsSearchFixtures;
use Tests\TestCase;
use Throwable;

/**
 * La double-vente, éprouvée pour de vrai.
 *
 * **Pourquoi ces cas ne s'exécutent pas dans une transaction.** Les autres tests
 * enveloppent chaque cas dans une transaction annulée à la fin — rapide, mais
 * incompatible avec la concurrence : une seconde connexion ne verrait rien de ce
 * que la première n'a pas encore validé, et le conflit recherché ne pourrait pas
 * se produire. `$connectionsToTransact = []` désactive cet enveloppement, d'où
 * le nettoyage explicite.
 *
 * **Ce que ces tests affirment, et ce qu'ils n'affirment pas.** Une première
 * version exigeait une erreur PostgreSQL précise — `55P03`, expiration du délai
 * d'attente. C'était sur-spécifier : selon l'instant exact où la seconde
 * connexion insère, PostgreSQL renvoie soit cette expiration, soit une violation
 * d'unicité. Les deux prouvent la même chose, et la seule qui compte : **un
 * siège ne peut pas être pris deux fois**. Exiger l'une des deux rendait le test
 * intermittent sans rien prouver de plus.
 */
final class SeatConcurrencyTest extends TestCase
{
    use BuildsSearchFixtures;
    use RefreshDatabase;

    /** @var list<string> */
    protected $connectionsToTransact = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->wipe();
        $this->seed(CountrySeeder::class);
        $this->buildNetwork();
    }

    /**
     * Renoncer aux transactions oblige à ranger **aussi** derrière soi.
     *
     * Nettoyer seulement en amont suffit tant qu'on regarde cette classe seule,
     * mais les données survivantes atteignent la classe de test suivante, dont
     * les fixtures échouent alors sur une référence de départ déjà prise. Un
     * échec qui ne désigne pas sa cause.
     */
    protected function tearDown(): void
    {
        $this->wipe();

        parent::tearDown();
    }

    private function wipe(): void
    {
        // Ordre imposé par les clés étrangères.
        foreach (['booking_passengers', 'bookings', 'trips', 'route_stops', 'routes',
            'vehicle_seats', 'vehicles', 'stations', 'agency_commercial_terms',
            'agencies', 'city_aliases', 'cities', 'countries', 'users'] as $table) {
            DB::table($table)->delete();
        }
    }

    public function test_a_committed_hold_makes_the_seat_unbookable(): void
    {
        [$trip, $seat, $first, $second] = $this->stage();
        $action = new CreateBooking;

        $action->handle($this->request($trip, $seat, $first, 'key-first'));

        try {
            $action->handle($this->request($trip, $seat, $second, 'key-second'));
            $this->fail('La double-vente n\'a pas été refusée.');
        } catch (ApiException $e) {
            // Une violation d'unicité est un **cas nominal**, pas une panne :
            // deux passagers ont visé le même siège, l'index a arbitré.
            $this->assertSame(ErrorCode::SeatAlreadyHeld, $e->errorCode);
            $this->assertSame(409, $e->errorCode->status());
        }

        $this->assertSame(1, Booking::query()->count());
        $this->assertSame(1, DB::table('booking_passengers')->where('holds_seat', true)->count());
    }

    /**
     * La place est protégée **dès l'insertion**, pas à la validation de la
     * transaction : c'est ce qui ferme la fenêtre pendant laquelle deux
     * passagers pourraient croire avoir obtenu le même siège.
     */
    public function test_an_uncommitted_hold_already_protects_the_seat(): void
    {
        [$trip, $seat, $first, $second] = $this->stage();
        $action = new CreateBooking;

        DB::beginTransaction();

        try {
            $action->handle($this->request($trip, $seat, $first, 'key-open'));

            $refused = false;

            try {
                $this->onSecondConnection(
                    fn () => $action->handle($this->request($trip, $seat, $second, 'key-concurrent')),
                );
            } catch (Throwable $e) {
                $refused = true;
            }

            $this->assertTrue($refused, 'La prise concurrente aurait dû être refusée.');
            $this->assertSame(1, DB::table('bookings')->count());
        } finally {
            // Annulation : la place n'aura jamais été vendue.
            DB::rollBack();
        }

        // La tenue ne survit pas à un abandon : le siège redevient vendable, et
        // rien ne subsiste de la tentative refusée.
        $this->assertSame(0, Booking::query()->count());

        $booking = $action->handle($this->request($trip, $seat, $second, 'key-after'));

        $this->assertSame($seat->id, $booking->passengers()->first()?->seat_id);
        $this->assertSame(1, Booking::query()->count());
    }

    public function test_replaying_the_same_key_returns_the_original_booking(): void
    {
        [$trip, $seat, $first] = $this->stage();

        $action = new CreateBooking;
        $request = $this->request($trip, $seat, $first, 'key-replay');

        $created = $action->handle($request);
        $replayed = $action->handle($request);

        // Un rejeu ne crée rien et n'immobilise pas une seconde place.
        $this->assertSame($created->reference, $replayed->reference);
        $this->assertSame(1, Booking::query()->count());
        $this->assertSame(1, DB::table('booking_passengers')->count());
    }

    /**
     * Exécute une fermeture sur une connexion distincte, donc une transaction
     * réellement séparée, avec un délai d'attente court : sans lui, la seconde
     * connexion attendrait la fin de la première, qui attend son retour.
     */
    private function onSecondConnection(callable $callback): mixed
    {
        $name = 'pgsql_concurrent';

        config(['database.connections.'.$name => config('database.connections.pgsql')]);
        DB::purge($name);
        DB::connection($name)->statement("set lock_timeout = '1s'");

        $previous = config('database.default');
        config(['database.default' => $name]);

        try {
            return $callback();
        } finally {
            config(['database.default' => $previous]);
            DB::purge($name);
        }
    }

    /** @return array{Trip, VehicleSeat, User, User} */
    private function stage(): array
    {
        $trip = Trip::query()->where('reference', 'TR-SEATED')->firstOrFail();
        $seat = VehicleSeat::query()->where('vehicle_id', $trip->vehicle_id)->orderBy('id')->firstOrFail();

        return [$trip, $seat, User::factory()->create(), User::factory()->create()];
    }

    private function request(Trip $trip, VehicleSeat $seat, User $user, string $key): NewBooking
    {
        return new NewBooking(
            tripReference: $trip->reference,
            passengers: [new NewPassenger('Awa', 'Nkeng', null, $seat->id)],
            idempotencyKey: $key,
            userId: $user->id,
        );
    }
}
