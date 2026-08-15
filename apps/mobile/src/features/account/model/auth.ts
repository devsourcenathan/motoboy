export type AuthIntent = 'signIn' | 'signUp'

export interface CredentialsForm {
  readonly phone: string
  readonly firstName: string
  readonly lastName: string
  /**
   * Facultatif, et le rester.
   *
   * Le contrat ne l'exige pas, et le produit ne s'en sert pour rien : les
   * billets et les alertes partent par SMS. L'imposer écarterait des passagers
   * qui n'ont pas d'adresse, ce qui est courant.
   */
  readonly email: string
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

/** Indicatif du Cameroun, seul pays desservi au MVP. */
export const DIALLING_CODE = '+237'

/**
 * Compose le numéro international à partir de ce qui est tapé **sous**
 * l'indicatif affiché.
 *
 * Trois saisies mènent au même numéro, parce que les trois se produisent :
 * `690000001` (ce que l'écran demande), `0690000001` (le format national, avec
 * son zéro), et `+237690000001` (un numéro collé depuis un contact). Sans quoi
 * le passager obtiendrait `+237+237…` ou un zéro de trop, et attendrait un code
 * parti nulle part.
 */
export function toInternational(input: string, code: string = DIALLING_CODE): string {
  const digits = normalisePhone(input)

  if (digits.startsWith('+')) return digits

  return `${code}${digits.replace(/^0+/, '')}`
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

/**
 * Longueur du code envoyé par SMS.
 *
 * Six chiffres, comme le serveur les émet. Elle sert à dessiner les cases et à
 * savoir quand la saisie est complète — pas à valider : seul le serveur décide
 * si un code est bon.
 */
export const OTP_LENGTH = 6

/**
 * Le numéro tel qu'on le rappelle sur l'écran de vérification.
 *
 * Masqué au milieu : il confirme qu'on a visé le bon téléphone sans réafficher
 * en clair un numéro que quelqu'un peut lire par-dessus l'épaule, dans une gare.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\s/g, '')

  if (digits.length < 5) return digits

  return `${digits.slice(0, 5)}${'*'.repeat(Math.max(0, digits.length - 7))}${digits.slice(-2)}`
}

export type OtpError = 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_TOO_MANY_ATTEMPTS'

/** Le code se saisit en chiffres : tout le reste est du bruit de clavier. */
export function normaliseCode(input: string): string {
  return input.replace(/\D/g, '')
}
