/**
 * Le numéro de téléphone, tel qu'on le tape et tel que le contrat l'exige.
 *
 * **Ces deux formes ne coïncident jamais**, et c'est le fond du problème. Le
 * contrat n'accepte que l'international — `+237690000001` — parce que ce numéro
 * porte à la fois l'identité du compte et la destination des SMS : billet,
 * alerte d'annulation, code de vérification. Personne, en revanche, ne dicte
 * son numéro ainsi. On écrit `690 00 00 01`, ou `0690000001`, ou on le colle
 * depuis un contact avec son indicatif déjà là.
 *
 * Traduire d'une forme à l'autre est donc le travail du client, à chaque
 * envoi et sans exception. L'oublier une seule fois produit la panne la plus
 * opaque du parcours : le serveur refuse le format, ou pire l'accepte et émet
 * un code pour un numéro qui n'existe pas — l'utilisateur attend alors un SMS
 * parti nulle part, sans rien à corriger à l'écran.
 *
 * Vit ici, et non dans une application : le web et le mobile ouvrent la même
 * session sur le même compte. Deux traductions divergentes feraient de deux
 * saisies identiques deux comptes distincts.
 */

/**
 * Reconnaissance volontairement **large** : le serveur reste seul juge (§29).
 * Un filtre client plus strict refuserait des numéros valides que l'on ne
 * connaît pas encore, et l'erreur serait alors imputée au numéro.
 */
const E164 = /^\+[1-9]\d{7,14}$/

/** Le numéro est-il sous une forme que le contrat acceptera ? */
export function isInternational(phone: string): boolean {
  return E164.test(normalisePhone(phone))
}

/** Retire ce qui aide à lire un numéro et n'appartient pas au format. */
export function normalisePhone(input: string): string {
  return input.replace(/[\s\-().]/g, '')
}

/** Indicatif du Cameroun, seul pays desservi au MVP. */
export const DIALLING_CODE = '+237'

/**
 * Compose le numéro international à partir de ce qui a été tapé.
 *
 * Trois saisies mènent au même numéro, parce que les trois se produisent :
 * `690000001` (ce que l'écran demande), `0690000001` (le format national, avec
 * son zéro), et `+237690000001` (un numéro collé depuis un contact). Sans quoi
 * l'on obtiendrait `+237+237…` ou un zéro de trop.
 *
 * L'indicatif reste un **paramètre**, alors qu'un seul pays est desservi et
 * que le défaut suffit partout aujourd'hui. `/v1/config` publie les pays sans
 * leur indicatif — la colonne `countries.phone_prefix` existe pourtant. Le
 * jour où le second pays arrive, il y aura un appelant à corriger, pas une
 * constante à débusquer dans deux applications.
 */
export function toInternational(input: string, code: string = DIALLING_CODE): string {
  const digits = normalisePhone(input)

  if (digits.startsWith('+')) return digits

  return `${code}${digits.replace(/^0+/, '')}`
}
