<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

use App\Modules\Payments\Enums\PaymentMethod;

final readonly class PaymentIntent
{
    public function __construct(
        /** Référence publique du paiement, transmise au prestataire pour rapprochement. */
        public string $reference,
        /** Entier, en unités entières de devise — le XAF n'a pas de subdivision. */
        public int $amount,
        public string $currency,
        public PaymentMethod $method,
        /** `MTN`, `ORANGE`… Nul hors Mobile Money. */
        public ?string $operator,
        /**
         * Compte débité.
         *
         * Un remboursement éventuel retournera **toujours** vers ce compte,
         * jamais vers un numéro déclaré après coup : sinon le circuit
         * « je réserve, j'annule, je me fais rembourser ailleurs » devient un
         * vecteur de fraude immédiat (B5).
         */
        public ?string $payerPhone,
        /** Clé d'idempotence, transmise au prestataire quand il la supporte. */
        public string $idempotencyKey,
    ) {}
}
