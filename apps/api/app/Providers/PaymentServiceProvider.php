<?php

declare(strict_types=1);

namespace App\Providers;

use App\Modules\Payments\Contracts\PaymentGateway;
use App\Modules\Payments\Gateways\NotchPayGateway;
use App\Modules\Payments\Gateways\TranzakPaymentGateway;
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
        $this->app->singleton(NotchPayGateway::class, function (): NotchPayGateway {
            foreach (['base_url', 'api_key', 'webhook_hash'] as $key) {
                $value = config("payments.notchpay.{$key}");

                if (!is_string($value) || $value === '') {
                    throw new \RuntimeException(
                        "NotchPay : « {$key} » manquant. Sans la clé de hachage, ".
                        'aucun webhook ne peut être prouvé authentique.',
                    );
                }
            }

            return new NotchPayGateway(
                baseUrl: (string) config('payments.notchpay.base_url'),
                apiKey: (string) config('payments.notchpay.api_key'),
                webhookHash: (string) config('payments.notchpay.webhook_hash'),
            );
        });

        /*
         * Tranzak se construit depuis la configuration : le conteneur ne sait pas
         * deviner trois chaines. Il refuse de le batir avec un reglage manquant
         * plutot que d'echouer au premier encaissement.
         */
        $this->app->singleton(TranzakPaymentGateway::class, function (): TranzakPaymentGateway {
            foreach (['base_url', 'app_id', 'app_key'] as $key) {
                $value = config("payments.tranzak.{$key}");

                if (!is_string($value) || $value === '') {
                    throw new \RuntimeException("Tranzak : « {$key} » manquant.");
                }
            }

            return new TranzakPaymentGateway(
                baseUrl: (string) config('payments.tranzak.base_url'),
                appId: (string) config('payments.tranzak.app_id'),
                appKey: (string) config('payments.tranzak.app_key'),
            );
        });

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
