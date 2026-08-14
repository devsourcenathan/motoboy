<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

use App\Modules\Payments\Enums\RefundStatus;

/**
 * Réponse de l'agrégateur à une demande de remboursement.
 *
 * Comme l'encaissement, un remboursement Mobile Money est **asynchrone** : le
 * prestataire accuse réception et confirme plus tard. Un pilote qui renverrait
 * un succès immédiat laisserait écrire du code incapable de gérer le vrai flux —
 * et le remboursement est précisément l'opération où l'écart entre « accepté »
 * et « arrivé » compte le plus pour le passager.
 */
final readonly class GatewayRefund
{
    private function __construct(
        public RefundStatus $status,
        public ?string $providerReference,
        public ?string $failureReason,
        /** Frais du remboursement lui-même, quand le prestataire les expose. */
        public int $feeAmount = 0,
    ) {}

    /** Demande acceptée, exécution en cours. */
    public static function accepted(string $providerReference, int $feeAmount = 0): self
    {
        return new self(RefundStatus::Processing, $providerReference, null, $feeAmount);
    }

    /** Refus immédiat — compte source fermé, solde du prestataire insuffisant. */
    public static function rejected(string $reason): self
    {
        return new self(RefundStatus::Failed, null, $reason);
    }

    public static function settled(string $providerReference, int $feeAmount = 0): self
    {
        return new self(RefundStatus::Completed, $providerReference, null, $feeAmount);
    }
}
