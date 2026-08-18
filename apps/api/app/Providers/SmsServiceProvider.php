<?php

declare(strict_types=1);

namespace App\Providers;

use App\Modules\Notifications\Contracts\SmsSender;
use App\Modules\Notifications\Senders\TechSoftSmsSender;
use Illuminate\Support\ServiceProvider;

/**
 * Résout le pilote SMS depuis la configuration.
 *
 * Le choix du fournisseur se fait **en configuration, jamais par un `if` dans
 * le code métier** (§7 du brief). Aucune Action ne connaît le nom d'un
 * prestataire.
 */
final class SmsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        /*
         * TechSoft se construit depuis la configuration : le conteneur ne sait
         * pas deviner trois chaines. Declare ici plutot que dans le pilote, pour
         * que `config/sms.php` reste une simple table de correspondance.
         */
        $this->app->singleton(TechSoftSmsSender::class, function (): TechSoftSmsSender {
            foreach (['base_url', 'api_token', 'sender_id'] as $key) {
                $value = config("sms.techsoft.{$key}");

                if (!is_string($value) || $value === '') {
                    throw new \RuntimeException(
                        "SMS TechSoft : « {$key} » manquant. Sans lui aucun code ne part, ".
                        'et une inscription sans OTP est une inscription impossible.',
                    );
                }
            }

            return new TechSoftSmsSender(
                baseUrl: (string) config('sms.techsoft.base_url'),
                apiToken: (string) config('sms.techsoft.api_token'),
                senderId: (string) config('sms.techsoft.sender_id'),
            );
        });

        $this->app->singleton(SmsSender::class, function (): SmsSender {
            $driver = config('sms.driver');
            $class = config("sms.drivers.{$driver}");

            if (!is_string($class) || !is_subclass_of($class, SmsSender::class)) {
                throw new \RuntimeException(
                    "Pilote SMS inconnu : « {$driver} ». Déclarer sa classe dans config/sms.php.",
                );
            }

            /** @var SmsSender */
            return $this->app->make($class);
        });
    }
}
