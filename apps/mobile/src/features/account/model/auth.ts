import { isInternational } from '@motoboy/shared'

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

/*
 * Le téléphone est traduit dans `@motoboy/shared`.
 *
 * **Le web ouvre la même session sur le même compte**, et n'avait pas cette
 * traduction : son formulaire d'inscription d'agence envoyait le numéro tel
 * quel. Deux traductions divergentes feraient de deux saisies identiques deux
 * comptes distincts — d'où le partage plutôt qu'une seconde copie.
 */
export {
  DIALLING_CODE,
  isInternational,
  normalisePhone,
  toInternational,
} from '@motoboy/shared'

export function validate(form: CredentialsForm, intent: AuthIntent): CredentialsError {
  if (!isInternational(form.phone)) return 'PHONE_INVALID'

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

/** L'accueil : la recherche d'un départ, ce pour quoi l'application est ouverte. */
export const HOME_ROUTE = '/search'

/**
 * Où atterrir une fois le code validé.
 *
 * `next` porte l'endroit d'où l'on a été renvoyé vers la connexion — le plan de
 * sièges, le plus souvent. En son absence, on vient du lancement de
 * l'application, et la destination est l'accueil : la même que pour l'entrée
 * sans compte.
 *
 * **Le profil n'est jamais la réponse.** Y déposer quelqu'un après une connexion
 * lui laisse croire qu'il reste une étape à faire, alors qu'il voulait
 * simplement chercher un départ.
 *
 * La chaîne vide est traitée comme une absence : un paramètre de navigation
 * effacé arrive sous cette forme, et le distinguer de `undefined` renverrait
 * vers nulle part.
 */
export function destinationAfterAuth(next: string | undefined): string {
  return next === undefined || next.trim() === '' ? HOME_ROUTE : next
}
