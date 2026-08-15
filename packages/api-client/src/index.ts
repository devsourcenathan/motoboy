import createClient from 'openapi-fetch'
import { NetworkError } from './errors.js'
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
  /**
   * Délai au-delà duquel une requête est abandonnée.
   *
   * Voir `DEFAULT_TIMEOUT_MS`.
   */
  timeoutMs?: number
}

/**
 * Vingt secondes.
 *
 * **Une requête sans délai n'échoue jamais : elle tourne.** Sur un réseau de
 * gare qui accepte la connexion puis ne répond plus, l'écran reste en
 * chargement indéfiniment et le passager n'a rien à faire d'autre que tuer
 * l'application — alors qu'un message d'échec lui offrirait de réessayer.
 *
 * Vingt secondes plutôt que cinq : une 3G camerounaise chargée met couramment
 * plusieurs secondes à répondre, et couper trop tôt transformerait une lenteur
 * en panne.
 */
export const DEFAULT_TIMEOUT_MS = 20_000

export type ApiClient = ReturnType<typeof createApiClient>

export function createApiClient(options: CreateApiClientOptions) {
  const { baseUrl, session } = options
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const underlying = options.fetch ?? fetch

  /*
   * Construit avec `AbortController` et `setTimeout`, **pas** avec
   * `AbortSignal.timeout` ni `AbortSignal.any` : React Native installe le
   * polyfill `abort-controller`, qui n'expose aucune de ces statiques. Les
   * utiliser lèverait « undefined is not a function » à la première requête,
   * sur l'appareil seulement — jamais à la compilation, puisque les types du
   * DOM les déclarent.
   *
   * Le délai **s'ajoute** au signal de l'appelant, il ne le remplace pas :
   * TanStack Query annule ses requêtes obsolètes par ce signal, et l'écraser
   * ferait continuer en arrière-plan des recherches déjà abandonnées.
   */
  const withTimeout: typeof fetch = async (input, init) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    /*
     * Le signal de l'appelant peut arriver par **deux chemins** :
     * `openapi-fetch` construit un `Request` et y pose le signal, puis appelle
     * `fetch(request, extra)` — il n'est donc pas dans `init`. Ne lire que
     * `init` revenait à ignorer toute annulation : les requêtes obsolètes de
     * TanStack Query continuaient jusqu'au délai, et leur abandon aurait été
     * pris pour une panne réseau.
     */
    const caller =
      init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request
        ? input.signal
        : undefined)

    const relay = () => controller.abort()
    if (caller) {
      if (caller.aborted) controller.abort()
      else caller.addEventListener('abort', relay)
    }

    try {
      return await underlying(input, { ...init, signal: controller.signal })
    } catch (cause) {
      /*
       * Une annulation venue de l'appelant n'est pas une panne : TanStack Query
       * abandonne ses requêtes obsolètes ainsi, et la déguiser en erreur réseau
       * ferait afficher « pas de réseau » à chaque frappe dans l'autocomplétion.
       */
      if (caller?.aborted === true) throw cause

      /*
       * Tout le reste — délai dépassé, DNS, connexion refusée — n'a jamais
       * atteint le serveur. `NetworkError` le dit, et c'est ce que la couche
       * de messages attend pour proposer de réessayer plutôt que d'annoncer une
       * panne du client.
       */
      throw new NetworkError(cause)
    } finally {
      clearTimeout(timer)
      caller?.removeEventListener('abort', relay)
    }
  }

  const client = createClient<paths>({
    baseUrl,
    fetch: withTimeout,
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
