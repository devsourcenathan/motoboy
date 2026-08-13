<?php

declare(strict_types=1);

namespace App\Support;

use Random\RandomException;

/**
 * Références publiques.
 *
 * Lisibles et **non devinables** : elles figurent sur le billet, servent de
 * secours à la saisie manuelle à l'embarquement (B3) et se dictent au
 * téléphone. Un identifiant séquentiel visible révélerait le volume d'affaires.
 */
final class Reference
{
    /**
     * Alphabet sans `I`, `O`, `0` ni `1`.
     *
     * Ces caractères se confondent à l'oral comme à l'écrit, et la référence est
     * précisément faite pour être dictée par téléphone à un agent qui la
     * ressaisit.
     */
    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    /** @throws RandomException */
    public static function generate(string $prefix, int $length = 6): string
    {
        $max = strlen(self::ALPHABET) - 1;
        $body = '';

        for ($i = 0; $i < $length; $i++) {
            $body .= self::ALPHABET[random_int(0, $max)];
        }

        return $prefix.'-'.$body;
    }
}
