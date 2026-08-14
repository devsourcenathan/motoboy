<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

use App\Modules\Payments\Enums\PaymentStatus;
use Carbon\CarbonImmutable;

/**
 * Une transaction telle que le prestataire la connaît.
 *
 * Volontairement pauvre : la réconciliation ne compare que ce que **tout**
 * agrégateur expose — une référence, un montant, un état, une date. Y ajouter
 * des champs propres à un prestataire ferait entrer son vocabulaire dans le code
 * métier, ce que le port existe pour empêcher (§7).
 */
final readonly class GatewayTransaction
{
    public function __construct(
        public string $providerReference,
        public int $amount,
        public string $currency,
        public PaymentStatus $status,
        public CarbonImmutable $occurredAt,
    ) {}
}
