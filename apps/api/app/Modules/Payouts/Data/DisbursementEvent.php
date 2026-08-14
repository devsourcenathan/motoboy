<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Data;

use App\Modules\Payouts\Enums\PayoutStatus;

/**
 * Sort réel d'un décaissement, annoncé par le prestataire.
 *
 * **Sans elle, un reversement resterait `PROCESSING` indéfiniment** — et comme un
 * reversement en vol interdit d'en construire un second, l'agence ne serait plus
 * jamais payée. L'état terminal doit arriver de quelque part.
 */
final readonly class DisbursementEvent
{
    public function __construct(
        public string $eventId,
        public string $providerReference,
        public PayoutStatus $status,
        public ?string $failureReason = null,
        public bool $signatureValid = true,
    ) {}
}
