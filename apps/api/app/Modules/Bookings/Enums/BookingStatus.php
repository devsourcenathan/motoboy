<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Enums;

/**
 * Cycle de vie d'une réservation (B2 du brief).
 *
 * Il n'existe volontairement **pas** d'état `FAILED` : l'échec appartient à la
 * tentative de paiement, pas à la réservation. Avec Mobile Money l'échec est
 * banal, et un passager qui recompose correctement son code doit retrouver son
 * siège — la fenêtre de tenue court en entier quelles que soient les tentatives.
 */
enum BookingStatus: string
{
    /** Les statuts qui immobilisent une place dans l'inventaire. */
    public function holdsSeat(): bool
    {
        return match ($this) {
            self::PendingPayment, self::Confirmed => true,
            default => false,
        };
    }

    public function isCancelled(): bool
    {
        return match ($this) {
            self::CancelledByPassenger, self::CancelledByAgency => true,
            default => false,
        };
    }
    case PendingPayment = 'PENDING_PAYMENT';
    case Confirmed = 'CONFIRMED';
    case Expired = 'EXPIRED';
    case CancelledByPassenger = 'CANCELLED_BY_PASSENGER';
    case CancelledByAgency = 'CANCELLED_BY_AGENCY';
    case Used = 'USED';
    case NoShow = 'NO_SHOW';
}
