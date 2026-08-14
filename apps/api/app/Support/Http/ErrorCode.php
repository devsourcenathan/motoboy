<?php

declare(strict_types=1);

namespace App\Support\Http;

/**
 * Codes d'erreur du contrat.
 *
 * Les clients branchent sur le **code**, jamais sur le message : l'écran
 * d'embarquement doit distinguer cinq issues, et un `422` accompagné d'une
 * phrase en français les obligerait à analyser du texte.
 *
 * Le message renvoyé par l'API est un **diagnostic** — journaux, exploitation.
 * Le texte visible se compose côté client à partir du code, ce qui garde la
 * localisation des erreurs entièrement cliente, sans négociation
 * `Accept-Language` (I10).
 *
 * Ajouter un cas d'échec, c'est ajouter un code **dans la spécification**, pas
 * détourner un code existant. Un test de parité y veille.
 */
enum ErrorCode: string
{
    case ValidationFailed = 'VALIDATION_FAILED';
    case Unauthenticated = 'UNAUTHENTICATED';
    case Forbidden = 'FORBIDDEN';
    case NotFound = 'NOT_FOUND';
    case RateLimited = 'RATE_LIMITED';

    case OtpInvalid = 'OTP_INVALID';
    case OtpExpired = 'OTP_EXPIRED';
    case OtpTooManyAttempts = 'OTP_TOO_MANY_ATTEMPTS';

    case SeatAlreadyHeld = 'SEAT_ALREADY_HELD';
    case TripFull = 'TRIP_FULL';
    case OnlineSalesClosed = 'ONLINE_SALES_CLOSED';
    case TripCancelled = 'TRIP_CANCELLED';
    case BookingExpired = 'BOOKING_EXPIRED';
    case BookingNotCancellable = 'BOOKING_NOT_CANCELLABLE';
    case CancellationDeadlinePassed = 'CANCELLATION_DEADLINE_PASSED';

    case PaymentAlreadySucceeded = 'PAYMENT_ALREADY_SUCCEEDED';
    case PaymentFailed = 'PAYMENT_FAILED';

    case TicketNotFound = 'TICKET_NOT_FOUND';
    case TicketAlreadyValidated = 'TICKET_ALREADY_VALIDATED';
    case TicketWrongTrip = 'TICKET_WRONG_TRIP';
    case TicketCancelled = 'TICKET_CANCELLED';

    case PayoutNotApprovable = 'PAYOUT_NOT_APPROVABLE';
    case PayoutNotSendable = 'PAYOUT_NOT_SENDABLE';
    case PayoutAccountUnverified = 'PAYOUT_ACCOUNT_UNVERIFIED';

    /** Statut HTTP associé, pour que chaque code ait une réponse cohérente. */
    public function status(): int
    {
        return match ($this) {
            self::ValidationFailed => 422,
            self::Unauthenticated => 401,
            self::Forbidden => 403,
            self::NotFound, self::TicketNotFound => 404,
            self::RateLimited => 429,
            self::OtpInvalid, self::OtpExpired, self::OtpTooManyAttempts => 422,
            default => 409,
        };
    }
}
