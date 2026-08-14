<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

use App\Modules\Payments\Enums\PaymentStatus;

/**
 * Notification de l'agrégateur, ramenée au vocabulaire métier.
 *
 * `eventId` porte l'idempotence : le couple `(provider, event_id)` est unique en
 * base, et les prestataires réémettent — un rejeu ne doit produire aucun
 * doublon (§29 du brief).
 */
final readonly class WebhookEvent
{
    public function __construct(
        public string $eventId,
        public string $providerReference,
        public PaymentStatus $status,
        public ?string $failureReason = null,
        public int $feeAmount = 0,
        public bool $signatureValid = true,
    ) {}
}
