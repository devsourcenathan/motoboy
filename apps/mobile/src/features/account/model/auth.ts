export type AuthIntent = 'signIn' | 'signUp'

export interface CredentialsForm {
  readonly phone: string
  readonly firstName: string
  readonly lastName: string
}

export type CredentialsError = 'PHONE_INVALID' | 'NAME_MISSING' | null

/**
 * Le numéro doit être au format international.
 *
 * Il porte l'identité du compte **et** la destination des SMS — billet, alerte
 * d'annulation, code de vérification. Un numéro saisi sans indicatif part vers
 * nulle part, et le passager n'en saura rien : il attendra un code qui n'arrive
 * pas.
 *
 * Vérification volontairement **large** : le serveur reste seul juge, et un
 * filtre trop strict côté client refuserait des numéros valides que l'on ne
 * connaît pas encore (§29).
 */
const E164 = /^\+[1-9]\d{7,14}$/

export function normalisePhone(input: string): string {
  // Les espaces et tirets sont naturels à la saisie et absents du format.
  return input.replace(/[\s\-().]/g, '')
}

export function validate(form: CredentialsForm, intent: AuthIntent): CredentialsError {
  if (!E164.test(normalisePhone(form.phone))) return 'PHONE_INVALID'

  if (intent === 'signUp') {
    if (form.firstName.trim() === '' || form.lastName.trim() === '') return 'NAME_MISSING'
  }

  return null
}

/**
 * Combien de temps attendre avant de proposer un nouvel envoi.
 *
 * **Chaque envoi coûte un SMS**, et l'OTP est le seul canal sans alternative :
 * un bouton toujours actif invite à insister, et la facture suit. Trente
 * secondes laissent le temps au message d'arriver sur un réseau lent avant que
 * le passager ne conclue qu'il s'est perdu (I8).
 */
export const RESEND_DELAY_SECONDS = 30

export type OtpError = 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_TOO_MANY_ATTEMPTS'

/** Le code se saisit en chiffres : tout le reste est du bruit de clavier. */
export function normaliseCode(input: string): string {
  return input.replace(/\D/g, '')
}
