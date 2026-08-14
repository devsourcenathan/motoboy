<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * La seule base que la suite a le droit de détruire.
     *
     * Volontairement écrit ici plutôt que relu depuis `phpunit.xml` : un
     * garde-fou qui tient sa valeur de ce qu'il surveille ne garde rien. Doit
     * rester identique au `DB_DATABASE` épinglé là-bas.
     */
    private const TEST_DATABASE = 'motoboy_test';

    /**
     * Refuse de lancer la suite ailleurs que sur la base de test.
     *
     * `RefreshDatabase` **supprime et recrée les tables**. Épingler la connexion
     * dans `phpunit.xml` ne suffit pas : ces valeurs alimentent `env()`, alors
     * que `RefreshDatabase` lit `config()`. Une configuration mise en cache —
     * `php artisan config:cache`, ou `optimize` — fige les valeurs du `.env` et
     * court-circuite l'épinglage **sans rien signaler**.
     *
     * Ce n'est pas théorique : c'est arrivé sur cette machine, et la suite a
     * vidé la base de développement. Avec un `.env` pointant sur la production
     * le temps d'un déploiement, elle aurait vidé la production.
     *
     * Le contrôle porte donc sur la configuration **effective**, celle que
     * `RefreshDatabase` utilisera, et s'exécute juste avant elle : c'est
     * `setUpTraits()` qui appelle `refreshDatabase()`.
     *
     * @return array<string, string>
     */
    protected function setUpTraits(): array
    {
        $this->assertRunningOnTheTestDatabase();

        return parent::setUpTraits();
    }

    private function assertRunningOnTheTestDatabase(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.{$connection}.database");
        $host = config("database.connections.{$connection}.host");

        if ($database === self::TEST_DATABASE && $this->isLocal($host)) {
            return;
        }

        throw new RuntimeException(sprintf(
            "La suite allait tourner sur « %s » (hôte %s) au lieu de « %s ».\n".
            "RefreshDatabase aurait supprimé ces tables.\n".
            'Cause la plus probable : une configuration en cache. Lancez `php artisan config:clear`.',
            is_string($database) ? $database : var_export($database, true),
            is_string($host) ? $host : var_export($host, true),
            self::TEST_DATABASE,
        ));
    }

    /** Une base de test est locale. Un hôte distant est toujours une erreur ici. */
    private function isLocal(mixed $host): bool
    {
        return is_string($host)
            && in_array($host, ['127.0.0.1', 'localhost', '::1', 'postgres'], true);
    }
}
