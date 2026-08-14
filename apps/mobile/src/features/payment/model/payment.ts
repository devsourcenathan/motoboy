import type { PaymentStatus } from '@motoboy/api-client/types'

export const OPERATORS = ['MTN', 'ORANGE'] as const

export type Operator = (typeof OPERATORS)[number]

export interface PaymentForm {
  readonly operator: Operator | null
  readonly payerPhone: string
}

export type PaymentFormError = 'OPERATOR_MISSING' | 'PHONE_MISSING' | null

export function validate(form: PaymentForm): PaymentFormError {
  if (form.operator === null) return 'OPERATOR_MISSING'
  if (form.payerPhone.trim() === '') return 'PHONE_MISSING'

  return null
}

/**
 * L'état d'un paiement, du point de vue de l'écran.
 *
 * `PENDING` et `PROCESSING` se disent de la même façon au passager — « vérifiez
 * votre téléphone » — parce que la différence est interne au prestataire et ne
 * lui offre aucun geste différent.
 */
export type PaymentPhase = 'form' | 'waiting' | 'failed' | 'succeeded'

export function phaseOf(status: PaymentStatus | undefined): PaymentPhase {
  if (status === undefined) return 'form'

  return {
    PENDING: 'waiting' as const,
    PROCESSING: 'waiting' as const,
    SUCCEEDED: 'succeeded' as const,
    FAILED: 'failed' as const,
  }[status]
}

/**
 * Faut-il continuer à interroger le serveur ?
 *
 * **Le verdict arrive par webhook**, pas dans la réponse à l'initiation : le
 * passager doit saisir son code sur son propre téléphone, et rien n'est encaissé
 * de façon synchrone. L'écran attend donc, et il attend en demandant.
 */
export function shouldPoll(status: PaymentStatus | undefined): boolean {
  return status === 'PENDING' || status === 'PROCESSING'
}

/**
 * Toutes les deux secondes.
 *
 * Assez court pour que la confirmation paraisse immédiate une fois le code
 * saisi, assez long pour ne pas marteler une connexion de gare pendant la
 * minute que peut prendre l'opérateur.
 */
export const POLL_INTERVAL_MS = 2000
