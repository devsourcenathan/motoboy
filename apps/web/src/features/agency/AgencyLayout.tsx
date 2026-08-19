import { NavLink as RouterNavLink, Outlet } from 'react-router'
import type { ReactNode } from 'react'
import { Logo } from '../../shared/ui'

/**
 * Le bandeau de l'espace agence.
 *
 * **L'ordre des onglets suit l'ordre du travail**, pas l'alphabet : gares, puis
 * véhicules, puis chauffeurs, puis itinéraires. C'est la seule séquence qui
 * fonctionne — un itinéraire a besoin de gares, un horaire a besoin d'un
 * véhicule — et une agence qui découvre l'outil suit les onglets de gauche à
 * droite sans qu'on ait à le lui expliquer.
 */
const TABS = [
  { to: '/agency/stations', label: 'Gares' },
  { to: '/agency/vehicles', label: 'Véhicules' },
  { to: '/agency/drivers', label: 'Chauffeurs' },
  { to: '/agency/routes', label: 'Itinéraires' },
  { to: '/agency/departures', label: 'Départs' },
  { to: '/agency/counter', label: 'Guichet' },
  { to: '/agency/boarding', label: 'Embarquement' },
  { to: '/agency/money', label: 'Compte' },
  { to: '/agency/staff', label: 'Personnel' },
] as const

export function AgencyLayout({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="min-h-screen">
      <header className="bg-ink-700">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <span className="flex items-center gap-2 font-bold text-neutral-0">
            <Logo variant="mark" size={26} />
            MOTOBOY — agence
          </span>
          <button
            type="button"
            onClick={onSignOut}
            className="text-sm text-neutral-0/80 hover:text-neutral-0"
          >
            Se déconnecter
          </button>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-6">
          {TABS.map((tab) => (
            <Tab key={tab.to} to={tab.to}>
              {tab.label}
            </Tab>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  )
}

function Tab({ to, children }: { to: string; children: ReactNode }) {
  return (
    <RouterNavLink
      to={to}
      className={({ isActive }) =>
        isActive
          ? 'border-b-2 border-brand-500 pb-2 text-sm font-semibold whitespace-nowrap text-neutral-0'
          : 'border-b-2 border-transparent pb-2 text-sm whitespace-nowrap text-neutral-0/70 hover:text-neutral-0'
      }
    >
      {children}
    </RouterNavLink>
  )
}
