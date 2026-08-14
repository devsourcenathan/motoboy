<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

/**
 * Demande de remboursement adressée à l'agrégateur.
 *
 * **Aucune destination.** Le prestataire reçoit la référence du paiement
 * d'origine et rend l'argent au compte qui l'a versé. Exposer un numéro de
 * destination ouvrirait le circuit « je réserve, j'annule, je me fais rembourser
 * ailleurs », qui est un vecteur de fraude immédiat (B5).
 */
final readonly class RefundIntent
{
    public function __construct(
        public string $reference,
        public string $paymentReference,
        public int $amount,
        public string $currency,
        /** Rejeu sûr côté prestataire : la même clé ne rembourse qu'une fois. */
        public string $idempotencyKey,
    ) {}
}
