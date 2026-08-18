import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'

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
