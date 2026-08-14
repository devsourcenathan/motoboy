<?php

declare(strict_types=1);

namespace App\Providers;

use App\Modules\Payments\Contracts\PaymentGateway;
use App\Modules\Payouts\Contracts\PayoutGateway;
use Illuminate\Support\ServiceProvider;

/**
 * Résout l'agrégateur et le décaisseur depuis la configuration.
 *
 * Le choix du fournisseur se fait **en configuration, jamais par un `if` dans le
 * code métier** (§7 du brief). Aucune Action ne connaît le nom d'un prestataire.
 *
 * Les deux ports sont résolus séparément : encaisser auprès d'un passager et
 * verser à une agence sont deux capacités distinctes de la grille de B4, et rien
 * n'oblige un seul prestataire à couvrir les deux.
 */
final class PaymentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->bindGateway(PaymentGateway::class, 'payments.gateway', 'payments.gateways', 'Agrégateur');
        $this->bindGateway(PayoutGateway::class, 'payments.payout_gateway', 'payments.payout_gateways', 'Décaisseur');
    }

    /** @param class-string $contract */
    private function bindGateway(string $contract, string $chosen, string $registry, string $label): void
    {
        $this->app->singleton($contract, function () use ($contract, $chosen, $registry, $label): object {
            $name = config($chosen);
            $class = config("{$registry}.{$name}");

            if (!is_string($class) || !is_subclass_of($class, $contract)) {
                throw new \RuntimeException(
                    "{$label} inconnu : « {$name} ». Déclarer sa classe dans config/payments.php.",
                );
            }

            return $this->app->make($class);
        });
    }
}
