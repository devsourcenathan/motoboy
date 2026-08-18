import Constants from 'expo-constants'
import { createApiClient } from '@motoboy/api-client'
import { session } from '../session/session'

/**
 * Adresse de l'API.
 *
 * `localhost` ne veut rien dire depuis un téléphone : sur un appareil réel il
 * désigne le téléphone lui-même. En développement, l'adresse du poste est
 * déduite de celle du serveur Metro — c'est la seule que l'appareil sait déjà
 * joindre, puisqu'il vient d'y charger le paquet.
 */
function resolveBaseUrl(): string {
  /*
   * ⚠️ **Notation pointée obligatoire.**
   *
   * Expo remplace `process.env.EXPO_PUBLIC_*` à la compilation, en repérant
   * l'accès par point. Écrit `process.env['EXPO_PUBLIC_API_URL']`, rien n'est
   * remplacé : la valeur vaut `undefined` dans le paquet et le réglage n'a
   * jamais d'effet, sans le moindre avertissement — vérifié en cherchant
   * l'adresse dans le bundle, où elle était absente.
   */
  const configured = process.env.EXPO_PUBLIC_API_URL

  if (configured) return configured

  const host = Constants.expoConfig?.hostUri?.split(':')[0]

  /*
   * **Une adresse de bouclage ne mène nulle part depuis un téléphone** : elle y
   * désigne l'appareil lui-même. Metro l'annonce pourtant quand il tourne en
   * mode localhost, et la déduction produit alors une adresse injoignable —
   * l'application affiche « pas de connexion » sans que rien ne soit en panne.
   *
   * Le dire plutôt que de le subir : il n'y a rien de mieux à déduire à
   * l'exécution, mais un message qui nomme la cause vaut mieux qu'un symptôme
   * qui accuse le réseau.
   */
  if (__DEV__ && (host === '127.0.0.1' || host === 'localhost')) {
    console.warn(
      `[api] Metro annonce « ${host} », que le téléphone ne peut pas joindre : ` +
        "il s'agit de lui-même. Renseignez EXPO_PUBLIC_API_URL dans apps/mobile/.env " +
        "avec l'IPv4 Wi-Fi du poste, puis relancez avec --clear.",
    )
  }

  return host ? `http://${host}:8000/api` : 'http://localhost:8000/api'
}

/**
 * Exportée pour le seul cas que le client généré ne couvre pas : l'envoi d'un
 * fichier en `multipart/form-data`. `FormData` de React Native porte des objets
 * `{uri, name, type}` que `fetch` sait sérialiser et qu'`openapi-fetch` ne
 * connaît pas — il les passerait à `JSON.stringify`.
 */
export const API_BASE_URL = resolveBaseUrl()

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  session,
})
