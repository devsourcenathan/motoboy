/**
 * La tenue des places, vue par l'interface.
 *
 * Partagée parce que la réservation la commence et que le paiement la subit :
 * les deux affichent le même compte à rebours, et une fonctionnalité n'en
 * importe pas une autre.
 */
export { HoldBanner, type HoldBannerProps } from './HoldBanner'
export { useHoldCountdown } from './useHoldCountdown'
export { Stepper, BOOKING_STEPS, type BookingStep } from './Stepper'
