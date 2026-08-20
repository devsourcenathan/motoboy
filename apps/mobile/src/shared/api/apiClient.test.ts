import { createApiClient, NetworkError } from '@motoboy/api-client'

/**
 * Le comportement réseau du client.
 *
 * Testé ici plutôt que dans le paquet parce que c'est le mobile qui en subit
 * les conséquences : c'est lui qui tourne sur une 3G de gare routière.
 */
describe('createApiClient', () => {
  const base = 'http://api.test/api'

  it('abandonne une requête qui ne répond jamais, et le dit', async () => {
    // Un serveur joignable qui n'aboutit plus : la connexion est acceptée, la
    // réponse n'arrive pas. Sans délai, l'écran resterait en chargement pour
    // toujours — le passager n'aurait que la fermeture de l'application.
    const hanging = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )

    const api = createApiClient({
      baseUrl: base,
      timeoutMs: 20,
      fetch: hanging as unknown as typeof fetch,
    })

    await expect(
      api.GET('/v1/places/autocomplete', { params: { query: { q: 'do' } } }),
    ).rejects.toBeInstanceOf(NetworkError)
  })

  /**
   * TanStack Query annule ses requêtes obsolètes par ce signal — une frappe de
   * plus dans l'autocomplétion. Les déguiser en panne ferait clignoter « pas de
   * réseau » à chaque lettre.
   */
  it('ne déguise pas une annulation de l’appelant en panne réseau', async () => {
    const controller = new AbortController()

    /*
     * Se comporte comme un vrai `fetch` : un signal **déjà** abandonné rejette
     * sur-le-champ. N'attendre que l'évènement laisserait la promesse pendante,
     * ce qu'aucune implémentation réelle ne fait.
     */
    const hanging = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const fail = () => reject(new Error('annulé par l’appelant'))

          if (init?.signal?.aborted === true) fail()
          else init?.signal?.addEventListener('abort', fail)
        }),
    )

    const api = createApiClient({
      baseUrl: base,
      timeoutMs: 5_000,
      fetch: hanging as unknown as typeof fetch,
    })

    const pending = api.GET('/v1/places/autocomplete', {
      params: { query: { q: 'do' } },
      signal: controller.signal,
    })

    controller.abort()

    await expect(pending).rejects.not.toBeInstanceOf(NetworkError)
  })

  it('laisse passer une réponse normale', async () => {
    const ok = jest.fn(
      async () =>
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    const api = createApiClient({
      baseUrl: base,
      timeoutMs: 5_000,
      fetch: ok as unknown as typeof fetch,
    })

    const result = await api.GET('/v1/places/autocomplete', {
      params: { query: { q: 'do' } },
    })

    expect(result.data).toEqual({ data: [] })
  })

  /**
   * La réponse de l'appareil n'est pas une `Response` du DOM.
   *
   * **Ce test existe parce que rien ne l'attrapait.** L'intercepteur renvoyait la
   * réponse reçue ; `openapi-fetch` y voit un *remplacement* et exige une
   * instance de `Response`. Dans Node c'en est une, donc tout passait — en Jest,
   * en typecheck, dans le bundle. Sur le téléphone, React Native fournit sa
   * propre implémentation, étrangère au `Response` global : **chaque requête
   * levait « onResponse must return new Response() »**, une erreur ni `ApiError`
   * ni `NetworkError`, donc affichée « une erreur inattendue » sur la connexion,
   * l'inscription et la liste des villes à la fois.
   *
   * On reproduit la condition en rendant une réponse d'une classe étrangère,
   * comme sur l'appareil.
   */
  it('traverse un intercepteur même quand la réponse n’est pas une Response du DOM', async () => {
    class ForeignResponse {
      readonly status = 200

      readonly ok = true

      readonly headers = new Map([['content-type', 'application/json']])

      json() {
        return Promise.resolve({ data: [] })
      }

      clone() {
        return this
      }
    }

    const api = createApiClient({
      baseUrl: base,
      fetch: (() => Promise.resolve(new ForeignResponse())) as unknown as typeof fetch,
    })

    const result = await api.GET('/v1/places/autocomplete', {
      params: { query: { q: 'do' } },
    })

    expect(result.data).toEqual({ data: [] })
  })
})
