import { createApiClient, Session, type TokenStore } from '@motoboy/api-client'

const TOKEN_KEY = 'motoboy.token'

/**
 * Coffre du navigateur.
 *
 * `localStorage` est lisible par tout script de la page : c'est acceptable ici
 * parce que le back-office ne charge aucun script tiers, et parce que
 * l'alternative — un cookie `HttpOnly` — supposerait une session côté serveur
 * que Sanctum en mode jeton n'a pas.
 *
 * Le port est asynchrone parce que le coffre du mobile l'est. Ici, les
 * promesses sont déjà résolues.
 */
const browserStore: TokenStore = {
  read: () => Promise.resolve(localStorage.getItem(TOKEN_KEY)),
  write: (token) => {
    localStorage.setItem(TOKEN_KEY, token)

    return Promise.resolve()
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)

    return Promise.resolve()
  },
}

export const session = new Session(browserStore)

/**
 * Client API du web.
 *
 * Le `401` purge la session plutôt que de la laisser dans un état incohérent —
 * le backend est la seule autorité sur la validité d'une session (§29 du brief).
 */
export const api = createApiClient({
  baseUrl: import.meta.env['VITE_API_URL'] ?? 'http://localhost:8000/api',
  session,
})
