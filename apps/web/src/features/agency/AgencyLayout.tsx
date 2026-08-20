import { useTranslation } from 'react-i18next'
import { NavLink as RouterNavLink, Outlet } from 'react-router'
import type { ReactNode } from 'react'
import { LocaleSwitch, Logo } from '../../shared/ui'

/**
 * Le bandeau de l'espace agence.
 *
 * **L'ordre des onglets suit l'ordre du travail**, pas l'alphabet : gares, puis
 * véhicules, puis chauffeurs, puis itinéraires. C'est la seule séquence qui
 * fonctionne — un itinéraire a besoin de gares, un horaire a besoin d'un
 * véhicule — et une agence qui découvre l'outil suit les onglets de gauche à
 * droite sans qu'on ait à le lui expliquer.
 */
/**
 * Les onglets portent une **clé**, pas un libellé.
 *
 * Ecrire le texte ici le figerait dans la langue du fichier : la barre de
 * navigation est visible sur chaque ecran de l'espace agence, et c'est le premier
 * endroit ou une traduction manquante se verrait.
 */
const TABS = [
  { to: '/agency/stations', key: 'stations' },
  { to: '/agency/vehicles', key: 'vehicles' },
  { to: '/agency/drivers', key: 'drivers' },
  { to: '/agency/routes', key: 'routes' },
  { to: '/agency/departures', key: 'departures' },
  { to: '/agency/counter', key: 'counter' },
  { to: '/agency/boarding', key: 'boarding' },
  { to: '/agency/money', key: 'money' },
  { to: '/agency/staff', key: 'staff' },
  { to: '/agency/documents', key: 'documents' },
] as const

export function AgencyLayout({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen">
      <header className="bg-ink-700">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <span className="flex items-center gap-2 font-bold text-neutral-0">
            <Logo variant="mark" size={26} />
            MOTOBOY — agence
          </span>
          <LocaleSwitch className="text-neutral-0" />

          <button
            type="button"
            onClick={onSignOut}
            className="text-sm text-neutral-0/80 hover:text-neutral-0"
          >
            {t('agency:nav.signOut')}
          </button>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-6">
          {TABS.map((tab) => (
            <Tab key={tab.to} to={tab.to}>
              {t(`agency:nav.${tab.key}`)}
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
