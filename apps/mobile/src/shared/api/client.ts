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

  return host ? `http://${host}:8000/api` : 'http://localhost:8000/api'
}

export const api = createApiClient({
  baseUrl: resolveBaseUrl(),
  session,
})
