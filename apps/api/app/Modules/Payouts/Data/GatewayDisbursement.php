<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Data;

use App\Modules\Payouts\Enums\PayoutStatus;

final readonly class GatewayDisbursement
{
    private function __construct(
        public PayoutStatus $status,
        public ?string $providerReference,
        public ?string $failureReason,
    ) {}

    /** Ordre accepté, fonds en route. */
    public static function accepted(string $providerReference): self
    {
        return new self(PayoutStatus::Processing, $providerReference, null);
    }

    /** Refus immédiat — compte fermé, solde de la plateforme insuffisant. */
    public static function rejected(string $reason): self
    {
        return new self(PayoutStatus::Failed, null, $reason);
    }

    public static function settled(string $providerReference): self
    {
        return new self(PayoutStatus::Paid, $providerReference, null);
    }
}
