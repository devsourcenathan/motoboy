<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Deux familles de données, volontairement séparées.
 *
 * **Référence** — pays, villes, rôles et permissions. Ces seeders sont
 * idempotents et destinés à être rejoués à chaque déploiement, y compris en
 * production : ils sont la source de vérité de la table de correspondance
 * rôles/permissions.
 *
 * **Démonstration** — agence, véhicules, départs et comptes de test. Jamais en
 * production. La garde est portée par l'environnement plutôt que par la
 * discipline : une commande lancée dans le mauvais terminal ne doit pas pouvoir
 * créer une fausse agence en production.
 */
final class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            CountrySeeder::class,
            CitySeeder::class,
            RoleAndPermissionSeeder::class,
        ]);

        if (app()->environment('production')) {
            $this->say('Environnement de production : données de démonstration ignorées.');

            return;
        }

        $this->call(DemoSeeder::class);
    }

    /**
     * Les seeders passent toujours par la commande `db:seed` — y compris depuis
     * les tests, où `seed()` l'invoque. `$this->command` est donc affecté, et
     * son type le dit.
     */
    private function say(string $message): void
    {
        $this->command->info($message);
    }
}
