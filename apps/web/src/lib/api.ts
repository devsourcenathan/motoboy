import { createApiClient } from '@motoboy/api-client'

const TOKEN_KEY = 'motoboy.token'

/**
 * Client API du web.
 *
 * Le jeton Sanctum est conservé en `localStorage`. Le `401` purge la session
 * plutôt que de la laisser dans un état incohérent — le backend est la seule
 * autorité sur la validité d'une session (§29 du brief).
 */
export const api = createApiClient({
  baseUrl: import.meta.env['VITE_API_URL'] ?? 'http://localhost:8000/api',
  getToken: () => localStorage.getItem(TOKEN_KEY),
  onUnauthenticated: () => {
    localStorage.removeItem(TOKEN_KEY)
  },
})

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}
