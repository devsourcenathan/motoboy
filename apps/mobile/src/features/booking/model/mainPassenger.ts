import * as SecureStore from 'expo-secure-store'

const KEY = 'motoboy.booking.mainPassenger'

/**
 * Ce qu'on retient du voyageur principal d'une réservation à l'autre.
 *
 * Volontairement pauvre : de quoi éviter la ressaisie, rien de plus. Chaque
 * champ ajouté ici est un champ à protéger, et un formulaire prérempli de
 * données qu'on n'a pas demandées inquiète plus qu'il n'aide.
 */
export interface MainPassenger {
  readonly firstName: string
  readonly lastName: string
  readonly phone: string
}

/**
 * **Dans le coffre du système, pas dans le cache en clair.**
 *
 * Les recherches récentes vivent dans `AsyncStorage` : deux villes et une date
 * que le passager vient de composer lui-même. Un nom et un numéro de téléphone
 * ne sont pas de cette nature — ils identifient une personne, et `AsyncStorage`
 * est lisible par toute application capable de lire le dossier de la nôtre sur
 * un appareil rooté. `expo-secure-store` s'appuie sur le Keystore Android et la
 * Keychain iOS, où le jeton de session est déjà rangé.
 *
 * Le coût est réel — le coffre est plus lent qu'un cache — mais il s'agit d'une
 * lecture par ouverture de formulaire, pas d'une boucle de rendu.
 */
export async function readMainPassenger(): Promise<MainPassenger | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)

    if (raw === null) return null

    const parsed: unknown = JSON.parse(raw)

    // Le stockage survit aux mises à jour : une forme ancienne ou corrompue est
    // ignorée plutôt que de faire planter l'écran de réservation.
    return isMainPassenger(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Retient le voyageur principal après une réservation aboutie.
 *
 * **Après, et non pendant la saisie** : mémoriser au fil de la frappe
 * enregistrerait des noms à moitié tapés, puis les proposerait à la réservation
 * suivante. Ce qui mérite d'être retenu est ce que le passager a validé.
 */
export async function rememberMainPassenger(passenger: MainPassenger): Promise<void> {
  const trimmed: MainPassenger = {
    firstName: passenger.firstName.trim(),
    lastName: passenger.lastName.trim(),
    phone: passenger.phone.trim(),
  }

  if (trimmed.firstName === '' || trimmed.lastName === '') return

  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(trimmed))
  } catch {
    // Un coffre indisponible ne doit pas faire échouer une réservation qui, elle,
    // a abouti : le confort de la prochaine saisie ne vaut pas ce prix.
  }
}

/**
 * Oublie le voyageur principal.
 *
 * Appelé à la déconnexion : laisser le nom du précédent utilisateur préremplir
 * le formulaire du suivant, sur un téléphone partagé, est une fuite — et une
 * confusion qui se termine par un billet au mauvais nom.
 */
export async function forgetMainPassenger(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY)
  } catch {
    // Rien à faire : le coffre est déjà inaccessible.
  }
}

function isMainPassenger(value: unknown): value is MainPassenger {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.firstName === 'string' &&
    typeof candidate.lastName === 'string' &&
    typeof candidate.phone === 'string'
  )
}
