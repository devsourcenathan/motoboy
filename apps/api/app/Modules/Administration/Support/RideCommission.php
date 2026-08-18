<?php

declare(strict_types=1);

namespace App\Modules\Administration\Support;

use App\Modules\Administration\Models\PlatformSetting;
use App\Modules\Identity\Models\User;

/**
 * Le taux de commission d'une course, en points de base (E4 bis).
 *
 * **Un taux unique, pas des conditions negociees.** Une agence negocie les
 * siennes ([B4](../../../docs/BRIEF.md)) parce qu'elle pese dans la negociation ;
 * un chauffeur independant ne negocie pas. Le taux vaut donc pour tous, et se
 * regle depuis le dashboard.
 *
 * Les points de base evitent d'arrondir : 10 % s'ecrit 1000, et une commission
 * de 1 250 F sur 12 500 F se calcule sans centime perdu.
 */
final class RideCommission
{
    public const KEY = 'rides.commission_bps';

    /** 10 % — la valeur retenue au lancement. */
    public const DEFAULT_BPS = 1_000;

    /**
     * Plafond volontaire.
     *
     * Un taux saisi avec un zero de trop prendrait la course entiere, et
     * personne ne s'en apercevrait avant le premier reversement. Trente pour
     * cent laisse toute la marge utile et rend l'erreur impossible.
     */
    public const MAX_BPS = 3_000;

    public function currentBps(): int
    {
        $value = PlatformSetting::query()->where('key', self::KEY)->value('value');

        // Reglage absent — base neuve, ou ligne supprimee : le defaut fait foi
        // plutot que zero, qui ferait travailler la plateforme gratuitement sans
        // rien signaler.
        if (!is_string($value) || !ctype_digit($value)) {
            return self::DEFAULT_BPS;
        }

        return min((int) $value, self::MAX_BPS);
    }

    /** La commission due sur un montant, arrondie a l'entier inferieur. */
    public function on(int $amount): int
    {
        return intdiv($amount * $this->currentBps(), 10_000);
    }

    public function update(int $bps, User $actor): int
    {
        $bounded = max(0, min($bps, self::MAX_BPS));

        PlatformSetting::query()->updateOrCreate(
            ['key' => self::KEY],
            ['value' => (string) $bounded, 'updated_by' => $actor->id],
        );

        return $bounded;
    }
}
