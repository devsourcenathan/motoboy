import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@motoboy/api-client'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router'
import { SignInPage } from './features/auth/SignInPage'
import { useCurrentUser, useSignOut } from './features/auth/useAuth'
import { DriverQueuePage } from './features/drivers/DriverQueuePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /*
       * Ne pas réessayer une réponse du serveur : un `403` ne devient pas un
       * `200` à la troisième tentative, et l'écran resterait en chargement le
       * temps de trois allers-retours avant de dire ce qu'il savait déjà.
       * Le reste — coupure, délai — mérite un essai de plus.
       */
      retry: (count, error) => !(error instanceof ApiError) && count < 1,
      staleTime: 30_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route
            path="/*"
            element={
              <RequireSession>
                <AdminLayout />
              </RequireSession>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

/**
 * Le garde de session.
 *
 * Il interroge l'API plutôt que de se fier à la présence d'un jeton : un jeton
 * révoqué côté serveur est indiscernable d'un jeton valide tant qu'on ne s'en
 * sert pas, et laisser entrer sur cette seule foi afficherait un back-office
 * vide en promettant qu'il ne l'est pas.
 */
function RequireSession({ children }: { children: React.ReactNode }) {
  const me = useCurrentUser()

  if (me.isPending) {
    return <p className="p-8 text-sm text-neutral-500">Vérification de la session…</p>
  }

  if (!me.data) return <Navigate to="/sign-in" replace />

  /*
   * **Le rôle se vérifie ici et de nouveau à chaque appel.** Cet écran ne
   * protège rien — il évite d'afficher des pages qui échoueraient ; c'est l'API
   * qui refuse, et elle seule fait autorité.
   */
  if (!me.data.roles.includes('ADMIN') && !me.data.roles.includes('SUPER_ADMIN')) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-bold text-ink-700">Espace réservé</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Ce compte n’a pas accès à l’administration.
        </p>
      </main>
    )
  }

  return <>{children}</>
}

function AdminLayout() {
  const signOut = useSignOut()

  return (
    <div className="min-h-screen">
      <header className="bg-ink-700 px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/drivers" className="font-bold text-neutral-0">
            MOTOBOY
          </Link>
          <button
            type="button"
            onClick={() => signOut.mutate()}
            className="text-sm text-neutral-0/80 hover:text-neutral-0"
          >
            Se déconnecter
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <Routes>
          <Route path="/drivers" element={<DriverQueuePage />} />
          {/* La file est la page d'accueil : c'est ce qui attend une décision. */}
          <Route path="*" element={<Navigate to="/drivers" replace />} />
        </Routes>
      </main>
    </div>
  )
}
