import type {
  BookingStatus,
  ErrorCode,
  Locale,
  PaymentMethod,
  PaymentStatus,
  RefundReason,
  RefundStatus,
  TicketStatus,
} from '@motoboy/api-client/types'
import { DEFAULT_LOCALE } from './locale.js'

/**
 * Libellés du vocabulaire métier.
 *
 * **Ce qui vit ici** : les libellés des énumérations du contrat, communs au web
 * et au mobile. **Ce qui n'y vit pas** : les textes d'interface propres à chaque
 * application — boutons, écrans, formulaires — qui relèvent de leur propre
 * catalogue i18n.
 *
 * Le type `Record<Locale, Record<Union, string>>` fait travailler le
 * compilateur dans les deux dimensions : ajouter une valeur à une énumération
 * de la spécification casse la compilation **dans chaque langue** tant que le
 * libellé manque, et ajouter une langue casse partout. C'est l'anti-dérive
 * recherchée en passant au langage unique (§6 du brief).
 */

export const bookingStatusLabels: Record<Locale, Record<BookingStatus, string>> = {
  fr: {
    PENDING_PAYMENT: 'En attente de paiement',
    CONFIRMED: 'Confirmée',
    EXPIRED: 'Expirée',
    CANCELLED_BY_PASSENGER: 'Annulée par le passager',
    CANCELLED_BY_AGENCY: "Annulée par l'agence",
    USED: 'Voyage effectué',
    NO_SHOW: 'Non présenté',
  },
  en: {
    PENDING_PAYMENT: 'Awaiting payment',
    CONFIRMED: 'Confirmed',
    EXPIRED: 'Expired',
    CANCELLED_BY_PASSENGER: 'Cancelled by passenger',
    CANCELLED_BY_AGENCY: 'Cancelled by agency',
    USED: 'Trip completed',
    NO_SHOW: 'No show',
  },
}

export const paymentStatusLabels: Record<Locale, Record<PaymentStatus, string>> = {
  fr: {
    PENDING: 'En attente',
    PROCESSING: 'En cours',
    SUCCEEDED: 'Payé',
    FAILED: 'Échoué',
  },
  en: {
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    SUCCEEDED: 'Paid',
    FAILED: 'Failed',
  },
}

export const paymentMethodLabels: Record<Locale, Record<PaymentMethod, string>> = {
  fr: {
    MOBILE_MONEY: 'Mobile Money',
    CARD: 'Carte bancaire',
    CASH: 'Espèces — guichet',
  },
  en: {
    MOBILE_MONEY: 'Mobile Money',
    CARD: 'Bank card',
    CASH: 'Cash — counter',
  },
}

export const refundStatusLabels: Record<Locale, Record<RefundStatus, string>> = {
  fr: {
    PENDING: 'En attente',
    PROCESSING: 'En cours',
    COMPLETED: 'Remboursé',
    FAILED: 'Échec du remboursement',
  },
  en: {
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    COMPLETED: 'Refunded',
    FAILED: 'Refund failed',
  },
}

export const refundReasonLabels: Record<Locale, Record<RefundReason, string>> = {
  fr: {
    PASSENGER_REQUEST: 'Annulation par le passager',
    AGENCY_TRIP_CANCELLED: "Départ annulé par l'agence",
    TRIP_MODIFIED: 'Voyage modifié',
    LATE_PAYMENT: 'Paiement abouti hors délai',
    DUPLICATE_PAYMENT: 'Paiement en double',
    ADMIN_ADJUSTMENT: 'Régularisation',
  },
  en: {
    PASSENGER_REQUEST: 'Cancelled by passenger',
    AGENCY_TRIP_CANCELLED: 'Departure cancelled by agency',
    TRIP_MODIFIED: 'Trip changed',
    LATE_PAYMENT: 'Payment completed after the deadline',
    DUPLICATE_PAYMENT: 'Duplicate payment',
    ADMIN_ADJUSTMENT: 'Adjustment',
  },
}

export const ticketStatusLabels: Record<Locale, Record<TicketStatus, string>> = {
  fr: {
    VALID: 'Valide',
    USED: 'Validé',
    CANCELLED: 'Annulé',
  },
  en: {
    VALID: 'Valid',
    USED: 'Checked in',
    CANCELLED: 'Cancelled',
  },
}

/**
 * Messages d'erreur destinés à l'utilisateur.
 *
 * Le `message` renvoyé par l'API est un **diagnostic** — journaux et
 * exploitation — et n'est jamais affiché : sa langue n'est pas garantie. Le
 * texte visible se compose ici, à partir du `code`. C'est ce qui permet de
 * localiser les erreurs entièrement côté client, sans négociation
 * `Accept-Language`.
 */
export const errorCodeLabels: Record<Locale, Record<ErrorCode, string>> = {
  fr: {
    VALIDATION_FAILED: 'Certaines informations sont incorrectes.',
    UNAUTHENTICATED: 'Votre session a expiré, reconnectez-vous.',
    FORBIDDEN: "Vous n'avez pas accès à cette ressource.",
    NOT_FOUND: 'Élément introuvable.',
    RATE_LIMITED: 'Trop de tentatives, patientez un instant.',
    OTP_INVALID: 'Code incorrect.',
    OTP_EXPIRED: 'Ce code a expiré, demandez-en un nouveau.',
    OTP_TOO_MANY_ATTEMPTS: 'Trop de tentatives, demandez un nouveau code.',
    SEAT_ALREADY_HELD: "Cette place vient d'être prise.",
    TRIP_FULL: 'Ce départ est complet.',
    ONLINE_SALES_CLOSED: 'Les réservations en ligne sont closes pour ce départ.',
    TRIP_CANCELLED: 'Ce départ a été annulé.',
    BOOKING_EXPIRED: 'Le délai de paiement est dépassé, les places ont été libérées.',
    BOOKING_NOT_CANCELLABLE: 'Cette réservation ne peut plus être annulée.',
    CANCELLATION_DEADLINE_PASSED: "Le délai d'annulation est dépassé.",
    PAYMENT_ALREADY_SUCCEEDED: 'Cette réservation est déjà payée.',
    PAYMENT_FAILED: 'Le paiement a échoué. Vous pouvez réessayer.',
    TICKET_NOT_FOUND: 'Billet introuvable.',
    TICKET_ALREADY_VALIDATED: 'Billet déjà validé.',
    TICKET_WRONG_TRIP: 'Ce billet concerne un autre départ.',
    TICKET_CANCELLED: 'Ce billet a été annulé.',
    PAYOUT_NOT_APPROVABLE: "Ce reversement n'est plus en attente de validation.",
    PAYOUT_NOT_SENDABLE: "Ce reversement doit être approuvé avant d'être envoyé.",
    PAYOUT_ACCOUNT_UNVERIFIED: 'Coordonnées de reversement non vérifiées.',
    AGENCY_NOT_PENDING: "Cette agence n'est pas en attente de validation.",
  },
  en: {
    VALIDATION_FAILED: 'Some of the details are incorrect.',
    UNAUTHENTICATED: 'Your session has expired, please sign in again.',
    FORBIDDEN: 'You do not have access to this resource.',
    NOT_FOUND: 'Not found.',
    RATE_LIMITED: 'Too many attempts, please wait a moment.',
    OTP_INVALID: 'Incorrect code.',
    OTP_EXPIRED: 'This code has expired, request a new one.',
    OTP_TOO_MANY_ATTEMPTS: 'Too many attempts, request a new code.',
    SEAT_ALREADY_HELD: 'This seat has just been taken.',
    TRIP_FULL: 'This departure is full.',
    ONLINE_SALES_CLOSED: 'Online booking has closed for this departure.',
    TRIP_CANCELLED: 'This departure has been cancelled.',
    BOOKING_EXPIRED: 'The payment window has passed and the seats were released.',
    BOOKING_NOT_CANCELLABLE: 'This booking can no longer be cancelled.',
    CANCELLATION_DEADLINE_PASSED: 'The cancellation deadline has passed.',
    PAYMENT_ALREADY_SUCCEEDED: 'This booking has already been paid.',
    PAYMENT_FAILED: 'The payment failed. You can try again.',
    TICKET_NOT_FOUND: 'Ticket not found.',
    TICKET_ALREADY_VALIDATED: 'Ticket already checked in.',
    TICKET_WRONG_TRIP: 'This ticket is for a different departure.',
    TICKET_CANCELLED: 'This ticket has been cancelled.',
    PAYOUT_NOT_APPROVABLE: 'This payout is no longer awaiting approval.',
    PAYOUT_NOT_SENDABLE: 'This payout must be approved before it can be sent.',
    PAYOUT_ACCOUNT_UNVERIFIED: 'Payout details have not been verified.',
    AGENCY_NOT_PENDING: 'This agency is not awaiting approval.',
  },
}

/** Raccourci de lecture, avec repli sur la langue par défaut. */
export function errorLabel(code: ErrorCode, locale: Locale = DEFAULT_LOCALE): string {
  return errorCodeLabels[locale][code]
}

/** Vrai si l'utilisateur peut réessayer sans repartir de zéro. */
export function isRetryable(code: ErrorCode): boolean {
  return code === 'PAYMENT_FAILED' || code === 'RATE_LIMITED'
}
