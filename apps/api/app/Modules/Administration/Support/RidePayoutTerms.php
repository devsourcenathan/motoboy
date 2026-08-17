<?php

declare(strict_types=1);

namespace App\Modules\Administration\Support;

use App\Modules\Administration\Models\PlatformSetting;
use App\Modules\Identity\Models\User;

/**
 * La cadence de reversement d'un chauffeur (E4 bis, tranche le 17 aout 2026).
 *
 * **Une agence negocie ses conditions, un chauffeur non.** `BuildPayout` lit le
 * delai et le minimum dans les `commercialTerms` de l'agence — conditions
 * negociees, portees par B4. Un chauffeur independant n'en a aucune, et il ne
 * negocie pas : les valeurs valent donc pour tous, et se reglent depuis le
 * dashboard comme la commission.
 *
 * Reglables plutot qu'en dur, pour la meme raison que le taux : ces deux valeurs se
 * corrigeront a l'usage — quand on saura ce que coute reellement un virement Mobile
 * Money et a quel rythme un chauffeur travaille — et un deploiement par ajustement
 * ferait qu'on ne les ajusterait pas.
 */
final class RidePayoutTerms
{
    public const DELAY_KEY = 'rides.payout_delay_hours';

    public const MINIMUM_KEY = 'rides.payout_minimum_amount';

    /**
     * 24 h — le meme defaut que les agences.
     *
     * Zero se defendait : la course est finie, il n'y a aucun depart a attendre
     * contrairement a une reservation. Mais un remboursement demande apres le
     * virement ne se recupere pas par une procedure, seulement par la bonne
     * volonte du chauffeur. Une journee laisse arriver la reclamation.
     */
    public const DEFAULT_DELAY_HOURS = 24;

    /**
     * 5 000 F — environ une course.
     *
     * Verser 500 F coute plus de frais qu'il n'en rapporte. Trop haut, un chauffeur
     * occasionnel n'est jamais paye ; ce seuil reste atteignable en une journee.
     */
    public const DEFAULT_MINIMUM_AMOUNT = 5_000;

    /**
     * Plafonds volontaires, sur le modele de la commission.
     *
     * Un zero de trop sur le delai retiendrait l'argent pendant des semaines, et sur
     * le minimum il ne serait jamais atteint. Personne ne s'en apercevrait avant
     * qu'un chauffeur ne reclame.
     */
    public const MAX_DELAY_HOURS = 168;

    public const MAX_MINIMUM_AMOUNT = 100_000;

    public function delayHours(): int
    {
        return $this->read(self::DELAY_KEY, self::DEFAULT_DELAY_HOURS, self::MAX_DELAY_HOURS);
    }

    public function minimumAmount(): int
    {
        return $this->read(self::MINIMUM_KEY, self::DEFAULT_MINIMUM_AMOUNT, self::MAX_MINIMUM_AMOUNT);
    }

    public function updateDelayHours(int $hours, User $actor): int
    {
        return $this->write(self::DELAY_KEY, $hours, self::MAX_DELAY_HOURS, $actor);
    }

    public function updateMinimumAmount(int $amount, User $actor): int
    {
        return $this->write(self::MINIMUM_KEY, $amount, self::MAX_MINIMUM_AMOUNT, $actor);
    }

    /**
     * Reglage absent ou illisible — base neuve, ligne supprimee, saisie manuelle
     * en base : le defaut fait foi plutot que zero. Zero verserait tout,
     * immediatement, sans que rien ne le signale.
     */
    private function read(string $key, int $default, int $max): int
    {
        $value = PlatformSetting::query()->where('key', $key)->value('value');

        if (!is_string($value) || !ctype_digit($value)) {
            return $default;
        }

        return min((int) $value, $max);
    }

    private function write(string $key, int $value, int $max, User $actor): int
    {
        $bounded = max(0, min($value, $max));

        PlatformSetting::query()->updateOrCreate(
            ['key' => $key],
            ['value' => (string) $bounded, 'updated_by' => $actor->id],
        );

        return $bounded;
    }
}
