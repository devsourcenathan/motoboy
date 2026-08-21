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

    /**
     * Panne de notre côté.
     *
     * **N'est jamais émis par l'API** : une erreur serveur n'atteint pas le
     * rendu d'erreur métier, elle sort du gestionnaire d'exceptions. Ce cas
     * existe pour que les clients aient un code à afficher quand la réponse
     * n'en porte aucun — sans lui, le repli rabattait tout statut inconnu sur
     * `VALIDATION_FAILED`, et une panne serveur se lisait « vérifiez votre
     * saisie ».
     */
    case ServerError = 'SERVER_ERROR';

    case OtpInvalid = 'OTP_INVALID';
    case OtpExpired = 'OTP_EXPIRED';
    case OtpTooManyAttempts = 'OTP_TOO_MANY_ATTEMPTS';

    /*
     * Se connecter avec un numero inconnu et se connecter avec un compte jamais
     * confirme sont deux situations, pas une. `NOT_FOUND` les confondait sous
     * « Element introuvable. » — un message qui ne dit ni de s'inscrire ni de
     * reprendre la confirmation, sur le seul ecran ou l'utilisateur ne peut rien
     * faire d'autre.
     */
    case AccountNotFound = 'ACCOUNT_NOT_FOUND';
    case AccountNotVerified = 'ACCOUNT_NOT_VERIFIED';

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

    /*
     * Appel de service (E1). Chaque conflit a son code : un `CONFLICT`
     * generique obligerait le client a lire le message pour savoir quoi
     * proposer, et ce message n'est pas garanti dans sa langue (I10).
     */
    case ServiceRequestAlreadyOpen = 'SERVICE_REQUEST_ALREADY_OPEN';
    case ServiceRequestClosed = 'SERVICE_REQUEST_CLOSED';
    case DriverNotApproved = 'DRIVER_NOT_APPROVED';
    case DriverBusy = 'DRIVER_BUSY';
    case OfferNotAcceptable = 'OFFER_NOT_ACCEPTABLE';
    case OfferAlreadyTaken = 'OFFER_ALREADY_TAKEN';
    case RideNotPaid = 'RIDE_NOT_PAID';

    /**
     * L'agence existe et le compte lui appartient : c'est l'admission qui
     * manque. Un `FORBIDDEN` générique ferait lire « vous n'avez pas accès à
     * cette ressource » — faux, et sans rien à faire de la réponse. Ici le
     * client peut dire ce qui bloque et ce qu'on attend.
     */
    case AgencyNotApproved = 'AGENCY_NOT_APPROVED';

    case PayoutNotApprovable = 'PAYOUT_NOT_APPROVABLE';
    case PayoutNotSendable = 'PAYOUT_NOT_SENDABLE';
    case PayoutAccountUnverified = 'PAYOUT_ACCOUNT_UNVERIFIED';
    case AgencyNotPending = 'AGENCY_NOT_PENDING';

    /** Statut HTTP associé, pour que chaque code ait une réponse cohérente. */
    public function status(): int
    {
        return match ($this) {
            self::ValidationFailed => 422,
            self::Unauthenticated => 401,
            self::Forbidden, self::AgencyNotApproved => 403,
            self::NotFound, self::TicketNotFound, self::AccountNotFound => 404,
            /*
             * 409 et non 404 : le compte **existe**, c'est son état qui bloque.
             * Le déclarer introuvable ferait proposer une inscription qui
             * échouerait sur un numéro déjà pris.
             */
            self::AccountNotVerified => 409,
            self::RateLimited => 429,
            self::ServerError => 500,
            self::OtpInvalid, self::OtpExpired, self::OtpTooManyAttempts => 422,
            default => 409,
        };
    }
}
