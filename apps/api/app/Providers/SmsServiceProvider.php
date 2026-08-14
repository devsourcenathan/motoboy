<?php

declare(strict_types=1);

namespace App\Providers;

use App\Modules\Notifications\Contracts\SmsSender;
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
