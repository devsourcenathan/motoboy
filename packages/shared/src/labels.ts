import type {
  BookingStatus,
  ErrorCode,
  PaymentMethod,
  PaymentStatus,
  RefundReason,
  RefundStatus,
  TicketStatus,
} from '@motoboy/api-client/types'

/**
 * Libellés d'affichage.
 *
 * Les enregistrements sont typés `Record<Union, string>` : ajouter une valeur
 * à une énumération de la spécification casse la compilation ici tant que le
 * libellé manque. C'est exactement l'anti-dérive recherchée en passant au
 * langage unique (§6 du brief).
 */

export const bookingStatusLabels: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'En attente de paiement',
  CONFIRMED: 'Confirmée',
  EXPIRED: 'Expirée',
  CANCELLED_BY_PASSENGER: 'Annulée par le passager',
  CANCELLED_BY_AGENCY: "Annulée par l'agence",
  USED: 'Voyage effectué',
  NO_SHOW: 'Non présenté',
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  SUCCEEDED: 'Payé',
  FAILED: 'Échoué',
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Carte bancaire',
  CASH: 'Espèces — guichet',
}

export const refundStatusLabels: Record<RefundStatus, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  COMPLETED: 'Remboursé',
  FAILED: 'Échec du remboursement',
}

export const refundReasonLabels: Record<RefundReason, string> = {
  PASSENGER_REQUEST: 'Annulation par le passager',
  AGENCY_TRIP_CANCELLED: "Départ annulé par l'agence",
  TRIP_MODIFIED: 'Voyage modifié',
  LATE_PAYMENT: 'Paiement abouti hors délai',
  DUPLICATE_PAYMENT: 'Paiement en double',
  ADMIN_ADJUSTMENT: 'Régularisation',
}

export const ticketStatusLabels: Record<TicketStatus, string> = {
  VALID: 'Valide',
  USED: 'Validé',
  CANCELLED: 'Annulé',
}

/**
 * Messages d'erreur destinés au passager.
 *
 * Le serveur renvoie déjà un `message`, mais il vise l'exploitation. Ces
 * libellés-ci sont ceux qu'on affiche.
 */
export const errorCodeLabels: Record<ErrorCode, string> = {
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
  BOOKING_NOT_CANCELLABLE: "Cette réservation ne peut plus être annulée.",
  CANCELLATION_DEADLINE_PASSED: "Le délai d'annulation est dépassé.",
  PAYMENT_ALREADY_SUCCEEDED: 'Cette réservation est déjà payée.',
  PAYMENT_FAILED: 'Le paiement a échoué. Vous pouvez réessayer.',
  TICKET_NOT_FOUND: 'Billet introuvable.',
  TICKET_ALREADY_VALIDATED: 'Billet déjà validé.',
  TICKET_WRONG_TRIP: "Ce billet concerne un autre départ.",
  TICKET_CANCELLED: 'Ce billet a été annulé.',
}

/** Vrai si le passager peut réessayer sans repartir de zéro. */
export function isRetryable(code: ErrorCode): boolean {
  return code === 'PAYMENT_FAILED' || code === 'RATE_LIMITED'
}
