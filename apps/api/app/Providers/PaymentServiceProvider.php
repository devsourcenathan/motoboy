<?php

declare(strict_types=1);

namespace App\Providers;

use App\Modules\Payments\Contracts\PaymentGateway;
use Illuminate\Support\ServiceProvider;

/**
 * Résout l'agrégateur depuis la configuration.
 *
 * Le choix du fournisseur se fait **en configuration, jamais par un `if` dans le
 * code métier** (§7 du brief). Aucune Action ne connaît le nom d'un prestataire.
 */
final class PaymentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PaymentGateway::class, function (): PaymentGateway {
            $gateway = config('payments.gateway');
            $class = config("payments.gateways.{$gateway}");

            if (!is_string($class) || !is_subclass_of($class, PaymentGateway::class)) {
                throw new \RuntimeException(
                    "Agrégateur inconnu : « {$gateway} ». Déclarer sa classe dans config/payments.php.",
                );
            }

            /** @var PaymentGateway */
            return $this->app->make($class);
        });
    }
}
