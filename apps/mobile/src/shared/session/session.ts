import * as SecureStore from 'expo-secure-store'
import { Session, type TokenStore } from '@motoboy/api-client'

const TOKEN_KEY = 'motoboy.token'

/**
 * Le jeton va dans le coffre du système, pas dans le stockage de
 * l'application.
 *
 * `AsyncStorage` écrit en clair dans le répertoire de l'application : sur un
 * téléphone déverrouillé ou une sauvegarde non chiffrée, le jeton se lit. Le
 * coffre — Keychain sur iOS, Keystore sur Android — est fait pour ça, et c'est
 * la raison d'être du port asynchrone côté `@motoboy/api-client`.
 *
 * Le cache des requêtes, lui, reste dans `AsyncStorage` : un billet mis en
 * cache n'est pas un secret, et le coffre n'est pas dimensionné pour du volume.
 */
const keychain: TokenStore = {
  read: () => SecureStore.getItemAsync(TOKEN_KEY),
  write: (token) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
}

/**
 * Une seule session pour toute l'application.
 *
 * Ce que fait `onExpired` — renvoyer vers l'accueil — est branché par la
 * coquille de navigation : ce module ne connaît pas le routeur, et l'y faire
 * entrer rendrait la session intestable hors application.
 */
export const session = new Session(keychain, () => {
  expiryHandlers.forEach((handler) => handler())
})

const expiryHandlers = new Set<() => void>()

/** @returns de quoi se désabonner. */
export function onSessionExpired(handler: () => void): () => void {
  expiryHandlers.add(handler)

  return () => {
    expiryHandlers.delete(handler)
  }
}
