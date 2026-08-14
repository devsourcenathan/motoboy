<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

use App\Modules\Payments\Enums\PaymentStatus;

final readonly class GatewayCharge
{
    private function __construct(
        public PaymentStatus $status,
        public ?string $providerReference,
        public ?string $failureReason,
        /** Frais réellement prélevés par l'agrégateur, quand il les expose. */
        public int $feeAmount = 0,
    ) {}

    /** Sollicitation partie ; le passager doit encore saisir son code. */
    public static function pending(string $providerReference): self
    {
        return new self(PaymentStatus::Processing, $providerReference, null);
    }

    /** Refus immédiat — numéro inconnu, opérateur indisponible. */
    public static function rejected(string $reason): self
    {
        return new self(PaymentStatus::Failed, null, $reason);
    }

    /**
     * Encaissement immédiat.
     *
     * Ne se produit pas en Mobile Money, mais reste possible en carte ou avec
     * un pilote de test.
     */
    public static function settled(string $providerReference, int $feeAmount = 0): self
    {
        return new self(PaymentStatus::Succeeded, $providerReference, null, $feeAmount);
    }
}
