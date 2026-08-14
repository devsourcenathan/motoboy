/**
 * Types du contrat, sans aucune exécution.
 *
 * Point d'entrée séparé du client HTTP — `@motoboy/api-client/types`.
 *
 * La raison est structurelle : le client a besoin de `fetch` et de `crypto`,
 * donc de la `lib` DOM. Les types, eux, n'ont besoin de rien. Les exposer
 * ensemble ferait fuiter la dépendance DOM vers tout consommateur de types,
 * `@motoboy/shared` en premier — dont la règle est précisément de n'en avoir
 * aucune (§6 du brief).
 *
 * Généré depuis `docs/openapi.yaml`. Jamais édité à la main.
 */
import type { components, paths } from './schema.js'

export type { components, paths }

type S = components['schemas']

export type Locale = S['Locale']

export type ErrorCode = S['ErrorCode']
/**
 * La **forme JSON** d'une réponse d'erreur. À ne pas confondre avec la classe
 * `ApiError`, qui est ce que l'on attrape : l'une est ce qui circule sur le
 * réseau, l'autre ce que le code manipule.
 */
export type ApiErrorBody = S['Error']
export type ValidationErrorBody = S['ValidationErrorBody']
export type PaginationMeta = S['PaginationMeta']

export type BookingStatus = S['BookingStatus']
export type PaymentStatus = S['PaymentStatus']
export type PaymentMethod = S['PaymentMethod']
export type RefundStatus = S['RefundStatus']
export type RefundReason = S['RefundReason']
export type TicketStatus = S['TicketStatus']
export type ValidationMethod = S['ValidationMethod']
export type SeatingMode = S['SeatingMode']
export type VehicleType = S['VehicleType']

export type User = S['User']

/** Défi OTP : validité de 10 minutes, 4 tentatives au maximum. */
export type OtpChallenge = S['OtpChallenge']
export type Money = S['Money']
export type PlaceSuggestion = S['PlaceSuggestion']
export type TripSummary = S['TripSummary']
export type TripDetail = S['TripDetail']
export type Seat = S['Seat']
export type SeatMap = S['SeatMap']
export type SearchSuggestions = S['SearchSuggestions']
export type Booking = S['Booking']
export type BookingPassenger = S['BookingPassenger']
export type CancellationPolicy = S['CancellationPolicy']

/** Résultat d'une annulation. `refund` est nul quand rien ne transite par la plateforme. */
export type BookingCancellation = S['BookingCancellation']
export type CancellationQuote = S['CancellationQuote']
export type Payment = S['Payment']
export type Refund = S['Refund']
export type Ticket = S['Ticket']
export type BoardingList = S['BoardingList']
export type BoardingPassenger = S['BoardingPassenger']
export type ValidationResult = S['ValidationResult']

/**
 * Affine une valeur vers la **forme JSON** d'une erreur. Pas d'I/O, donc
 * utilisable partout — y compris là où `fetch` n'existe pas.
 *
 * Pour attraper une erreur levée, c'est `instanceof ApiError` qu'il faut :
 * cette fonction ne reconnaît qu'un corps de réponse.
 */
export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code: unknown }).code === 'string'
  )
}
