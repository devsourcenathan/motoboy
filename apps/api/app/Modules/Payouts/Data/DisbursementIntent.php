<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Data;

/**
 * Ordre de versement à une agence.
 *
 * Contrairement au remboursement, la destination est ici **explicite** : il n'y
 * a pas de paiement d'origine vers lequel renvoyer l'argent. C'est aussi ce qui
 * rend le changement de coordonnées un vecteur de fraude classique — d'où la
 * vérification exigée en amont, jamais dans l'adaptateur (B4).
 */
final readonly class DisbursementIntent
{
    public function __construct(
        public string $reference,
        public int $amount,
        public string $currency,
        public string $accountType,
        public ?string $operator,
        public string $accountNumber,
        public string $accountName,
        /** Rejeu sûr côté prestataire : la même clé ne verse qu'une fois. */
        public string $idempotencyKey,
    ) {}
}
