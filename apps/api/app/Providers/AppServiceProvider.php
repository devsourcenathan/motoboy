<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\ServiceProvider;

final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->resolveModuleFactories();
        $this->enforceStrictModels();
    }

    /**
     * Les modèles vivent dans `App\Modules\{Module}\Models\{Model}` (§6 du
     * brief), alors que Laravel déduit la fabrique du namespace du modèle et
     * chercherait `Database\Factories\Modules\{Module}\Models\{Model}Factory`.
     *
     * On corrige la convention une fois ici plutôt que par un `newFactory()`
     * sur chaque modèle : la structure modulaire ne doit pas coûter une
     * surcharge par classe.
     *
     * `App\Modules\Identity\Models\User` → `Database\Factories\Identity\UserFactory`
     */
    private function resolveModuleFactories(): void
    {
        Factory::guessFactoryNamesUsing(static function (string $model): string {
            $module = str_replace(['App\\Modules\\', '\\Models'], '', $model);
            $factory = 'Database\\Factories\\'.$module.'Factory';

            // La vérification n'est pas une formalité pour satisfaire l'analyse
            // statique : sans elle, un modèle utilisant `HasFactory` sans
            // fabrique échouerait sur un « class not found » opaque, loin de sa
            // cause. L'exception nomme la classe attendue.
            if (!is_subclass_of($factory, Factory::class)) {
                throw new \RuntimeException(
                    "Fabrique introuvable pour {$model} — attendue : {$factory}",
                );
            }

            return $factory;
        });
    }

    /**
     * Trois gardes qui transforment des erreurs silencieuses en erreurs
     * bruyantes, en dehors de la production.
     *
     * L'accès à une relation non chargée est la cause la plus courante de
     * requête dans une boucle — invisible en développement, fatale sur une
     * liste de départs.
     */
    private function enforceStrictModels(): void
    {
        Model::shouldBeStrict(!$this->app->isProduction());
    }
}
