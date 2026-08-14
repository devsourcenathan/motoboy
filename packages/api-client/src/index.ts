import createClient from 'openapi-fetch'
import type { paths } from './schema.js'
import { Session } from './session.js'

/**
 * Client HTTP typé par le contrat OpenAPI.
 *
 * Ce point d'entrée requiert la `lib` DOM pour `fetch` et `crypto`. Les
 * consommateurs qui n'ont besoin que des types doivent importer
 * `@motoboy/api-client/types`, qui n'exige rien.
 */
export * from './types.js'
export * from './errors.js'
export * from './session.js'

export interface CreateApiClientOptions {
  baseUrl: string
  /**
   * La session. Le client y lit le jeton et lui signale les `401` — il ne
   * connaît ni le coffre du système ni le stockage du navigateur.
   */
  session?: Session
  fetch?: typeof fetch
}

export type ApiClient = ReturnType<typeof createApiClient>

export function createApiClient(options: CreateApiClientOptions) {
  const { baseUrl, session } = options

  const client = createClient<paths>({
    baseUrl,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  })

  client.use({
    async onRequest({ request }) {
      const token = await session?.token()
      if (token) request.headers.set('Authorization', `Bearer ${token}`)
      request.headers.set('Accept', 'application/json')
      return request
    },
    async onResponse({ response }) {
      // Purge immédiate : laisser un jeton mort en place ferait renvoyer 401
      // à chaque écran suivant, et l'application semblerait cassée plutôt que
      // déconnectée.
      if (response.status === 401) session?.expire()
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
