<?php

declare(strict_types=1);

namespace App\Modules\Payments\Enums;

enum RefundReason: string
{
    case PassengerRequest = 'PASSENGER_REQUEST';
    case AgencyTripCancelled = 'AGENCY_TRIP_CANCELLED';
    case TripModified = 'TRIP_MODIFIED';

    /** Paiement abouti après expiration de la tenue, place déjà revendue (B2). */
    case LatePayment = 'LATE_PAYMENT';

    case DuplicatePayment = 'DUPLICATE_PAYMENT';
    case AdminAdjustment = 'ADMIN_ADJUSTMENT';
}
