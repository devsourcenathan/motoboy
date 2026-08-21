<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Trips\Models\Trip;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Support\BuildsSearchFixtures;
use Tests\TestCase;

/**
 * Retirer les données de démonstration d'une base réelle.
 *
 * **Cette commande s'exécute sur la production**, et c'est la seule du dépôt
 * dans ce cas. Elle est née d'un `db:seed` sans `--class` lancé contre Neon : la
 * garde de `DatabaseSeeder` teste `APP_ENV`, pas la base visée, et deux agences
 * fictives se sont retrouvées à vendre cent soixante-quatorze départs dans la
 * recherche publique.
 *
 * Ce que ces tests gardent n'est donc pas « la commande fonctionne » mais
 * **« la commande ne détruit pas plus qu'elle ne doit »**.
 */
final class PurgeDemoDataTest extends TestCase
{
    use BuildsSearchFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(CountrySeeder::class);
        $this->seed(CitySeeder::class);

        // Le réseau de test porte exactement les noms que sème `DemoSeeder`.
        $this->buildNetwork();
    }

    /**
     * **Un essai à blanc ne touche à rien.**
     *
     * C'est la seule chose qui rend cette commande relisible avant d'être
     * lancée sur des données réelles : sans elle, on découvre ce qu'elle fait
     * en le lui faisant faire.
     */
    public function test_a_dry_run_changes_nothing(): void
    {
        $avant = Trip::query()->count();

        $this->assertSame(0, Artisan::call('motoboy:purge-demo'));

        $this->assertSame($avant, Trip::query()->count());
        $this->assertSame(2, Agency::query()->where('status', 'APPROVED')->count());
    }

    /**
     * **Un départ portant une réservation est épargné, et l'agence survit.**
     *
     * Le schéma l'impose autant que le bon sens : `bookings.trip_id` et
     * `bookings.agency_id` sont en `RESTRICT`. Une commande qui passerait outre
     * emporterait le paiement, le billet et la commission d'un passager réel
     * pour faire du ménage.
     */
    public function test_a_booked_departure_survives_the_purge(): void
    {
        $reserve = Trip::query()->where('reference', 'TR-SEATED')->firstOrFail();
        $libre = Trip::query()->where('reference', 'TR-CAPACITY')->firstOrFail();

        /*
         * Les conditions commerciales sont **recopiées sur la réservation** et
         * non lues sur l'agence : elles ne doivent pas changer sous une vente
         * déjà faite. D'où ces colonnes obligatoires, qu'un test ne peut pas
         * omettre.
         */
        DB::table('bookings')->insert([
            'reference' => 'MTB-TEST01',
            'trip_id' => $reserve->id,
            'agency_id' => $reserve->agency_id,
            'channel' => 'ONLINE',
            'status' => 'CONFIRMED',
            'seats_count' => 1,
            'total_amount' => 6500,
            'commission_type' => 'PERCENTAGE',
            'commission_value' => 800,
            'fee_bearer' => 'PLATFORM',
            'cancellation_deadline_hours' => 2,
            'cancellation_fee_type' => 'PERCENTAGE',
            'cancellation_fee_value' => 2000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertSame(0, Artisan::call('motoboy:purge-demo', ['--confirm' => true]));

        $this->assertNotNull(Trip::query()->find($reserve->id));
        $this->assertNull(Trip::query()->find($libre->id));

        // Les agences restent — elles portent une histoire — mais quittent la
        // publication : c'est la règle qui retire leurs départs de la recherche.
        $this->assertSame(2, Agency::query()->count());
        $this->assertSame(0, Agency::query()->where('status', 'APPROVED')->count());
    }

    /**
     * **Les horaires s'arrêtent avant que les départs partent.**
     *
     * Dans l'ordre inverse, l'ordonnanceur régénérerait tout à son passage
     * suivant, et le ménage n'aurait tenu qu'une nuit.
     */
    public function test_the_purge_stops_what_would_regenerate(): void
    {
        $this->assertSame(0, Artisan::call('motoboy:purge-demo', ['--confirm' => true]));

        $this->assertSame(0, DB::table('routes')->where('is_active', true)->count());
        $this->assertSame(0, DB::table('schedules')->where('is_active', true)->count());
    }

    /**
     * **La cause, plutôt que la conséquence.**
     *
     * `DatabaseSeeder` gardait ces données derrière `app()->environment()` — une
     * étiquette portée par la configuration du client, pas par la base qu'il
     * vise. Un poste branché sur la production porte `APP_ENV=local` **et** parle
     * à Neon : la garde laissait passer, et deux agences fictives se sont mises
     * à vendre cent soixante-quatorze départs dans la recherche publique.
     *
     * Ce qui est éprouvé ici est la décision seule. Le branchement — lire la
     * connexion **résolue** et non `config()`, qui rend le défaut du fichier
     * tant que la base vient de `DB_URL` — porte son propre commentaire : la
     * première version lisait `config()` et aurait laissé semer sur Neon en
     * affirmant le contraire.
     */
    public function test_the_demo_seeder_tells_a_remote_database_from_a_local_one(): void
    {
        foreach (['', 'localhost', '127.0.0.1', '::1', 'postgres', 'db'] as $local) {
            $this->assertFalse(DemoSeeder::isRemote($local), $local.' est local.');
        }

        foreach ([
            'ep-billowing-flower-ayjs4knw.c-5.us-east-2.aws.neon.tech',
            'db.exemple.com',
            '10.0.0.5',
        ] as $ailleurs) {
            $this->assertTrue(DemoSeeder::isRemote($ailleurs), $ailleurs.' est ailleurs.');
        }
    }

    /** Sur une base sans données de démonstration, la commande ne fait rien. */
    public function test_it_does_nothing_where_there_is_nothing(): void
    {
        Agency::query()->update(['name' => 'Agence réelle']);

        $avant = Trip::query()->count();

        /*
         * `Artisan::call` plutôt que `$this->artisan(…)` : le second rend
         * `PendingCommand|int`, un type union que Larastan refuse de laisser
         * chaîner. Lire la sortie à part est aussi plus explicite sur ce qui
         * est vérifié.
         */
        $this->assertSame(0, Artisan::call('motoboy:purge-demo', ['--confirm' => true]));
        $this->assertStringContainsString('Aucune donnée de démonstration', Artisan::output());

        $this->assertSame($avant, Trip::query()->count());
    }
}
