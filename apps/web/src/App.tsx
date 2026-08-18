import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@motoboy/api-client'
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink as RouterNavLink,
  Route,
  Routes,
} from 'react-router'
import { SignInPage } from './features/auth/SignInPage'
import { useCurrentUser, useSignOut } from './features/auth/useAuth'
import { DriverQueuePage } from './features/drivers/DriverQueuePage'
import { PayoutAccountsPage } from './features/payouts/PayoutAccountsPage'
import { PayoutQueuePage } from './features/payouts/PayoutQueuePage'
import { SupportLookupPage } from './features/support/SupportLookupPage'
import { AgencyLayout } from './features/agency/AgencyLayout'
import { DriversPage } from './features/agency/DriversPage'
import { RoutesPage } from './features/agency/RoutesPage'
import { BoardingPage } from './features/agency/BoardingPage'
import { BoardingScannerPage } from './features/boarding/BoardingScannerPage'
import { OwnerPage } from './features/owner/OwnerPage'
import { SearchPage } from './features/public/SearchPage'
import { TripPage } from './features/public/TripPage'
import { CounterSalePage } from './features/agency/CounterSalePage'
import { DeparturesPage } from './features/agency/DeparturesPage'
import { MoneyPage } from './features/agency/MoneyPage'
import { StaffPage } from './features/agency/StaffPage'
import { StationsPage } from './features/agency/StationsPage'
import { VehiclesPage } from './features/agency/VehiclesPage'

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
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

/**
 * Le routage, **séparé des fournisseurs**.
 *
 * `App` portait les deux, si bien qu'un test ne pouvait pas le rendre sous un
 * `MemoryRouter` sans imbriquer deux routeurs — React Router refuse, et le
 * back-office était donc intestable en entier. Exporté ici, il se rend sous le
 * routeur que l'appelant choisit ; c'est aussi le découpage naturel, un routeur
 * n'ayant rien à faire dans la définition des routes.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/*
        **Le public d'abord, à la racine.** La recherche fonctionne sans compte
        (§35) : c'est le premier écran du produit, et le mettre derrière une
        connexion perdrait les gens sur une question qu'ils ne se posaient pas.
        L'administration descend donc sous `/admin`.
      */}
      <Route path="/" element={<SearchPage />} />
      <Route path="/trips/:reference" element={<TripPage />} />

      <Route path="/sign-in" element={<SignInPage />} />

      {/*
        Deux espaces distincts derrière la même connexion. Une agence et un
        administrateur n'ont ni les mêmes écrans ni les mêmes droits, et les
        mélanger sous un seul menu obligerait chacun à ignorer la moitié de ce
        qu'il voit.
      */}
      {/*
        L'embarquement est **hors du gabarit d'agence** : il tourne sur un
        téléphone tenu à bout de bras, sur un quai, et un bandeau d'onglets y
        volerait la moitié de l'écran. Il partage la session, pas la mise en page.
      */}
      <Route
        path="/boarding"
        element={
          <RequireSession allow={['AGENCY', 'AGENT']}>
            <BoardingScannerPage />
          </RequireSession>
        }
      />

      {/*
        Le proprietaire n'a qu'une page : lui donner un gabarit a onglets ferait
        promettre une profondeur qui n'existe pas, et qui ne doit pas exister —
        aucun circuit financier ne le relie a la plateforme (I3).
      */}
      <Route
        path="/owner"
        element={
          <RequireSession allow={['OWNER']}>
            <OwnerPage />
          </RequireSession>
        }
      />

      <Route
        path="/agency/*"
        element={
          <RequireSession allow={['AGENCY', 'AGENT']}>
            <AgencySpace />
          </RequireSession>
        }
      />

      <Route
        path="/admin/*"
        element={
          <RequireSession allow={['ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout />
          </RequireSession>
        }
      />
    </Routes>
  )
}

function AgencySpace() {
  const signOut = useSignOut()

  return (
    <Routes>
      <Route element={<AgencyLayout onSignOut={() => signOut.mutate()} />}>
        <Route path="stations" element={<StationsPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="departures" element={<DeparturesPage />} />
        <Route path="counter" element={<CounterSalePage />} />
        <Route path="boarding" element={<BoardingPage />} />
        <Route path="money" element={<MoneyPage />} />
        <Route path="staff" element={<StaffPage />} />
        {/* Les gares d'abord : tout le reste de l'inventaire s'y rattache. */}
        <Route path="*" element={<Navigate to="/agency/stations" replace />} />
      </Route>
    </Routes>
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
function RequireSession({
  allow,
  children,
}: {
  allow: readonly string[]
  children: React.ReactNode
}) {
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
  if (!me.data.roles.some((role) => allow.includes(role))) {
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

/**
 * Un lien du bandeau, souligne quand il est actif.
 *
 * `NavLink` de react-router plutot qu'une comparaison manuelle sur l'URL : celle
 * ecrite a la main oublie les sous-chemins, et le lien s'eteint des qu'on ouvre
 * un detail.
 */
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <RouterNavLink
      to={to}
      className={({ isActive }) =>
        isActive
          ? 'border-b-2 border-brand-500 pb-0.5 text-sm font-semibold text-neutral-0'
          : 'pb-0.5 text-sm text-neutral-0/70 hover:text-neutral-0'
      }
    >
      {children}
    </RouterNavLink>
  )
}

function AdminLayout() {
  const signOut = useSignOut()

  return (
    <div className="min-h-screen">
      <header className="bg-ink-700 px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link to="/admin/drivers" className="font-bold text-neutral-0">
              MOTOBOY
            </Link>
            <NavLink to="/admin/drivers">Dossiers</NavLink>
            <NavLink to="/admin/payouts">Reversements</NavLink>
            <NavLink to="/admin/payout-accounts">Comptes</NavLink>
            <NavLink to="/admin/support">Suivi</NavLink>
          </nav>
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
          <Route path="drivers" element={<DriverQueuePage />} />
          <Route path="payouts" element={<PayoutQueuePage />} />
          <Route path="payout-accounts" element={<PayoutAccountsPage />} />
          <Route path="support" element={<SupportLookupPage />} />
          {/* La file est la page d'accueil : c'est ce qui attend une décision. */}
          <Route path="*" element={<Navigate to="/admin/drivers" replace />} />
        </Routes>
      </main>
    </div>
  )
}
