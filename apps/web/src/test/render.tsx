import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { expect, vi } from 'vitest'

/**
 * Rend un écran avec ce qu'il attend autour de lui.
 *
 * **Un client de requêtes neuf par test.** Partagé, son cache ferait passer un
 * test grâce aux données d'un autre — et le même test échouerait seul. Les
 * réessais sont coupés : une erreur attendue mettrait sinon plusieurs secondes à
 * se manifester, ce qui transforme un test rapide en test lent puis en test
 * qu'on désactive.
 */
export function render(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }

  return rtlRender(ui, { wrapper: Wrapper })
}

/**
 * Une réponse d'API, sans réseau.
 *
 * Rend une vraie `Response` plutôt qu'un objet qui lui ressemble : c'est ce que
 * le client d'API manipule, et un faux approximatif laisserait passer les bogues
 * qui viennent précisément de cette différence — le projet en a déjà rencontré
 * trois sur l'appareil.
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Programme les réponses, dans l'ordre où les requêtes partent. */
export function mockFetch(...responses: Response[]): void {
  const mock = fetch as unknown as ReturnType<typeof vi.fn>

  for (const response of responses) {
    mock.mockResolvedValueOnce(response)
  }
}

/**
 * Programme les réponses **par URL**, et non dans l'ordre.
 *
 * L'ordre est fragile dès qu'un écran fait plusieurs requêtes : un champ de
 * recherche qui interroge à l'ouverture puis à chaque frappe consomme les
 * réponses prévues pour d'autres appels, et le test échoue en désignant le
 * mauvais endroit. Une correspondance par motif dit aussi **ce que le test
 * suppose du serveur**, ce qu'une file anonyme ne dit pas.
 *
 * Le motif est cherché dans l'URL ; la première entrée qui correspond gagne, donc
 * les plus spécifiques se placent en tête.
 */
export function mockRoutes(routes: Record<string, () => Response>): void {
  const mock = fetch as unknown as ReturnType<typeof vi.fn>

  mock.mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String((input as Request).url)

    for (const [pattern, respond] of Object.entries(routes)) {
      if (url.includes(pattern)) return Promise.resolve(respond())
    }

    /*
     * Une requête non prévue **échoue bruyamment** plutôt que de rendre une
     * réponse vide : un écran qui appelle un endpoint auquel personne n'a pensé
     * est précisément ce qu'un test doit révéler.
     */
    return Promise.reject(new Error(`Aucune réponse prévue pour ${url}`))
  })
}

/**
 * Les URL appelées, dans l'ordre.
 *
 * Sert à vérifier **ce que l'écran a demandé** — un test qui ne regarde que le
 * rendu laisse passer un écran qui affiche la bonne chose après avoir appelé le
 * mauvais endpoint.
 */
export function calledUrls(): string[] {
  const mock = fetch as unknown as ReturnType<typeof vi.fn>

  return mock.mock.calls.map(([input]) =>
    typeof input === 'string' ? input : String((input as Request).url),
  )
}

/**
 * Attend la requête qui correspond, puis rend son corps décodé.
 *
 * **`waitFor` ne veut pas de rappel asynchrone.** Il relance le sien à intervalle
 * fixe sans attendre que l'invocation précédente se termine : un rappel qui
 * `await` voit donc plusieurs exécutions se chevaucher. Quatre tests lisaient le
 * corps de la requête *à l'intérieur* du `waitFor`, et l'un d'eux tombait dans la
 * suite complète tout en passant seul — le symptôme exact d'une course, et le
 * genre d'instabilité qui apprend à relancer la CI jusqu'à ce qu'elle verdisse.
 *
 * Ici l'attente ne fait qu'une chose, de façon synchrone : constater que la
 * requête est partie. Le corps se lit ensuite, une seule fois.
 */
export async function sentRequest(
  match: (request: Request) => boolean,
): Promise<unknown> {
  const sent = () =>
    (fetch as unknown as { mock: { calls: [Request | string][] } }).mock.calls
      .map(([input]) => input)
      .filter((input): input is Request => typeof input !== 'string')

  await waitFor(() => expect(sent().some(match)).toBe(true))

  const request = sent().find(match)

  if (request === undefined) {
    throw new Error('Requête introuvable après attente.')
  }

  // Cloné : le corps est un flux, et le lire ici le consommerait pour de bon.
  return JSON.parse(await request.clone().text())
}
