<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Support;

/**
 * Contenu encodé dans le QR Code d'un billet.
 *
 * Format : `MTB1:<référence>:<signature>`.
 *
 * **Pourquoi un préfixe de version.** Le jour où le format changera, les billets
 * déjà émis devront rester lisibles : un passager peut avoir capturé son écran
 * une semaine avant son voyage. Sans marqueur, on ne saurait pas distinguer un
 * ancien format d'une charge corrompue.
 *
 * **Pourquoi la signature n'est pas vérifiée par l'appareil de l'agent.** Elle
 * exigerait de distribuer la clé de signature sur chaque téléphone d'agent : un
 * appareil volé permettrait alors de forger des billets pour **toutes** les
 * agences. Hors ligne, l'autorité est donc la **liste d'embarquement**
 * pré-téléchargée — appartenir à la liste est ce qui fait foi (B3). La signature
 * sert côté serveur, à la synchronisation et à la saisie manuelle en ligne.
 *
 * **Pourquoi une signature courte.** Seize caractères hexadécimaux suffisent à
 * écarter une forge opportuniste, et un QR plus dense devient difficile à lire
 * sur un écran fissuré ou un billet imprimé froissé — deux cas que B3 impose de
 * prévoir.
 */
final class QrPayload
{
    private const VERSION = 'MTB1';

    private const SIGNATURE_LENGTH = 16;

    public static function encode(string $reference): string
    {
        return self::VERSION.':'.$reference.':'.self::sign($reference);
    }

    /** Extrait la référence, ou `null` si la charge n'est pas exploitable. */
    public static function reference(string $payload): ?string
    {
        $parts = explode(':', $payload);

        if (count($parts) !== 3 || $parts[0] !== self::VERSION) {
            return null;
        }

        return $parts[1] === '' ? null : $parts[1];
    }

    /**
     * Vérifie la signature, en temps constant.
     *
     * `hash_equals` et non `===` : une comparaison qui s'arrête au premier
     * caractère différent laisse mesurer la signature attendue, octet par octet.
     */
    public static function verify(string $payload): bool
    {
        $parts = explode(':', $payload);

        if (count($parts) !== 3 || $parts[0] !== self::VERSION) {
            return false;
        }

        return hash_equals(self::sign($parts[1]), $parts[2]);
    }

    public static function sign(string $reference): string
    {
        return substr(hash_hmac('sha256', $reference, self::key()), 0, self::SIGNATURE_LENGTH);
    }

    /**
     * Clé dérivée de celle de l'application, avec séparation de domaine.
     *
     * Réutiliser `APP_KEY` telle quelle mêlerait la signature des billets au
     * chiffrement des sessions : compromettre l'un donnerait l'autre.
     */
    private static function key(): string
    {
        $appKey = config('app.key');

        return hash_hmac('sha256', 'motoboy.tickets', is_string($appKey) ? $appKey : '');
    }
}
