<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

use App\Modules\Payments\Enums\RefundStatus;

/**
 * Notification de l'agrégateur portant sur un **remboursement**.
 *
 * Distincte de `WebhookEvent` plutôt que fondue dedans : les deux flux n'ont ni
 * les mêmes statuts ni les mêmes conséquences, et un champ « type » à
 * interpréter dans une classe commune ferait porter la distinction au lecteur au
 * lieu du typage. Le prestataire envoie tout sur le même endpoint ; c'est
 * l'adaptateur qui tranche.
 */
final readonly class RefundEvent
{
    public function __construct(
        public string $eventId,
        public string $providerReference,
        public RefundStatus $status,
        public ?string $failureReason = null,
        /** Coût du remboursement lui-même, connu seulement ici (B5). */
        public int $feeAmount = 0,
        public bool $signatureValid = true,
    ) {}
}
