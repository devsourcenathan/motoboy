import createClient from 'openapi-fetch'
import type { paths } from './schema.js'

/**
 * Client HTTP typé par le contrat OpenAPI.
 *
 * Ce point d'entrée requiert la `lib` DOM pour `fetch` et `crypto`. Les
 * consommateurs qui n'ont besoin que des types doivent importer
 * `@motoboy/api-client/types`, qui n'exige rien.
 */
export * from './types.js'

export interface CreateApiClientOptions {
  baseUrl: string
  /** Renvoie le jeton Sanctum courant, ou `null` hors session. */
  getToken?: () => string | null | Promise<string | null>
  /** Appelé sur `401`, pour que l'application purge sa session. */
  onUnauthenticated?: () => void
  fetch?: typeof fetch
}

export type ApiClient = ReturnType<typeof createApiClient>

export function createApiClient(options: CreateApiClientOptions) {
  const { baseUrl, getToken, onUnauthenticated } = options

  const client = createClient<paths>({
    baseUrl,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  })

  client.use({
    async onRequest({ request }) {
      const token = await getToken?.()
      if (token) request.headers.set('Authorization', `Bearer ${token}`)
      request.headers.set('Accept', 'application/json')
      return request
    },
    async onResponse({ response }) {
      if (response.status === 401) onUnauthenticated?.()
      return response
    },
  })

  return client
}

/**
 * Génère une clé d'idempotence.
 *
 * L'en-tête `Idempotency-Key` est obligatoire sur la création de réservation,
 * l'initiation de paiement, l'annulation et la synchronisation des
 * validations. La clé doit être **conservée par l'appelant** entre les
 * tentatives : en régénérer une à chaque essai reviendrait à ne pas avoir
 * d'idempotence du tout.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}
