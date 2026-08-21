<?php

declare(strict_types=1);

namespace App\Modules\Administration\Console;

use App\Modules\Agencies\Models\Agency;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Retirer les données de démonstration d'une base réelle.
 *
 * **Elles y sont arrivées par un `php artisan db:seed` sans `--class`.** La
 * garde de `DatabaseSeeder` teste `APP_ENV` et non la base visée : lancée depuis
 * un poste de développement branché sur la production — ce que la documentation
 * recommande, faute de shell chez l'hébergeur — elle y sème deux agences, leur
 * inventaire et près de deux cents départs. Ces départs paraissent dans la
 * recherche publique comme n'importe quels autres.
 *
 * ---
 *
 * **Ce que cette commande ne fait pas, et ne peut pas faire.**
 *
 * Elle ne supprime pas les agences. Le schéma l'interdit, délibérément :
 * `bookings.agency_id`, `commissions.agency_id` et `agency_ledger_entries` sont
 * en `RESTRICT`. Une agence qui porte une histoire financière n'est pas
 * effaçable, et c'est une garantie qu'on ne contourne pas pour faire du ménage —
 * supprimer une réservation emporterait son paiement, son billet et sa
 * commission.
 *
 * Elle épargne donc chaque départ portant une réservation, un billet ou une
 * validation, et le dit. Le reste — ce qui n'a jamais servi — s'en va.
 *
 * Les agences repassent en `PENDING` : leurs départs restants quittent la
 * recherche publique par la même règle que n'importe quelle agence non admise,
 * sans rien détruire. C'est réversible d'un clic dans l'administration.
 */
final class PurgeDemoDataCommand extends Command
{
    /**
     * Les noms viennent de `DemoSeeder`.
     *
     * Viser par le nom plutôt que par l'identifiant : ce dernier change d'une
     * base à l'autre, et la commande doit être **relisible avant d'être
     * exécutée** par quelqu'un qui ne connaît pas la base.
     */
    private const NAMES = ['Général Express', 'Western Voyages'];

    protected $signature = 'motoboy:purge-demo {--confirm : Exécuter réellement}';

    protected $description = 'Retire les départs de démonstration et met leurs agences hors publication.';

    public function handle(): int
    {
        $agencies = Agency::query()->whereIn('name', self::NAMES)->get();

        if ($agencies->isEmpty()) {
            $this->info('Aucune donnée de démonstration : rien à faire.');

            return self::SUCCESS;
        }

        $ids = $agencies->pluck('id');
        $trips = DB::table('trips')->whereIn('agency_id', $ids)->pluck('id');
        $routes = DB::table('routes')->whereIn('agency_id', $ids)->pluck('id');

        /*
         * Un départ est **intouchable** dès qu'une trace y pend. Les quatre
         * tables sont listées explicitement plutôt que déduites : une clé
         * étrangère ajoutée demain doit apparaître ici, et non faire échouer
         * une suppression au milieu d'une transaction.
         */
        $spared = collect()
            ->merge(DB::table('bookings')->whereIn('trip_id', $trips)->pluck('trip_id'))
            ->merge(DB::table('tickets')->whereIn('trip_id', $trips)->pluck('trip_id'))
            ->merge(DB::table('ticket_validations')->whereIn('trip_id', $trips)->pluck('trip_id'))
            ->merge(DB::table('booking_passengers')->whereIn('trip_id', $trips)->pluck('trip_id'))
            ->unique()
            ->values();

        $removable = $trips->diff($spared)->values();

        $this->newLine();
        $this->line('Agences visées : '.$agencies->pluck('name')->implode(', '));
        $this->table(['Ce qui se passe', 'Nombre'], [
            ['Départs supprimés', $removable->count()],
            ['Départs épargnés (réservation, billet ou validation)', $spared->count()],
            ['Horaires désactivés', DB::table('schedules')->whereIn('route_id', $routes)->count()],
            ['Itinéraires fermés', $routes->count()],
            ['Agences remises en attente', $agencies->count()],
        ]);

        if (!$this->option('confirm')) {
            $this->newLine();
            $this->warn('Essai à blanc : rien n\'a été modifié. Relancer avec --confirm.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($ids, $routes, $removable): void {
            /*
             * Les horaires d'abord : l'ordonnanceur génère les départs toutes
             * les nuits, et supprimer avant d'arrêter la production laisserait
             * tout revenir au prochain passage.
             */
            DB::table('schedules')->whereIn('route_id', $routes)->update(['is_active' => false]);
            DB::table('routes')->whereIn('agency_id', $ids)->update(['is_active' => false]);

            // Par lots : une clause `IN` de deux cents identifiants passe, de
            // vingt mille non — et cette commande servira peut-être ailleurs.
            $removable->chunk(500)->each(
                fn ($lot) => DB::table('trips')->whereIn('id', $lot)->delete(),
            );

            DB::table('agencies')->whereIn('id', $ids)->update([
                'status' => 'PENDING',
                'approved_at' => null,
                'updated_at' => now(),
            ]);
        });

        $this->newLine();
        $this->info('Fait. Les départs restants quittent la recherche : leurs agences ne sont plus admises.');

        return self::SUCCESS;
    }
}
