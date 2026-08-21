import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import type { ReactNode } from 'react'
import { unwrap } from '@motoboy/api-client'
import { api } from '../../lib/api'
import {
  Badge,
  Icon,
  LocaleSwitch,
  Logo,
  type IconName,
  type Tone,
} from '../../shared/ui'

/**
 * La coquille de l'espace agence.
 *
 * **Dix onglets alignés ne se lisent pas, ils défilent.** La barre horizontale
 * dépassait la largeur de la plupart des écrans : « Documents » et « Personnel »
 * vivaient hors du champ, et ce qui défile hors de l'écran cesse d'exister.
 *
 * D'où la barre latérale, groupée par **moment du travail** plutôt que par type
 * de donnée : ce qu'on déclare une fois, ce qu'on fait tous les jours, ce qu'on
 * règle rarement. L'ordre à l'intérieur d'un groupe reste imposé par les données
 * — un itinéraire a besoin de gares, un horaire a besoin d'un véhicule — et une
 * agence qui découvre l'outil descend la liste sans qu'on le lui explique.
 */
type Item = { readonly to: string; readonly key: string; readonly icon: IconName }

/*
 * Typé plutôt que figé par `as const` : ce dernier produit des **tuples**, que
 * `flatMap` refuse d'aplatir. Le type dit la même contrainte sans la rigidité.
 */
const GROUPS: readonly { readonly key: string; readonly items: readonly Item[] }[] = [
  {
    key: 'inventory',
    items: [
      { to: '/agency/stations', key: 'stations', icon: 'agencies' },
      { to: '/agency/vehicles', key: 'vehicles', icon: 'trips' },
      { to: '/agency/drivers', key: 'drivers', icon: 'drivers' },
      { to: '/agency/routes', key: 'routes', icon: 'arrow' },
    ],
  },
  {
    key: 'operations',
    items: [
      { to: '/agency/departures', key: 'departures', icon: 'trips' },
      { to: '/agency/counter', key: 'counter', icon: 'tickets' },
      { to: '/agency/boarding', key: 'boarding', icon: 'check' },
    ],
  },
  {
    key: 'admin',
    items: [
      { to: '/agency/money', key: 'money', icon: 'money' },
      { to: '/agency/staff', key: 'staff', icon: 'users' },
      { to: '/agency/documents', key: 'documents', icon: 'document' },
    ],
  },
]

type Agency = {
  reference?: string
  name?: string
  status?: string
}

/**
 * Le dossier de l'agence, pour le bandeau.
 *
 * **Aucun endpoint ne le rendait**, et le bandeau annonçait « MOTOBOY — agence »
 * à tout le monde. Le manque est devenu criant quand les agences en attente ont
 * pu entrer dans leur espace : elles y travaillent, leurs départs ne paraissent
 * pas, et rien ne disait pourquoi.
 */
function useAgency() {
  return useQuery({
    queryKey: ['agency', 'self'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/v1/agency', { signal })),
  })
}

const STATUS_TONES: Record<string, Tone> = {
  APPROVED: 'good',
  PENDING: 'action',
  REJECTED: 'alert',
}

const STATUS_KEYS: Record<string, string> = {
  APPROVED: 'approved',
  PENDING: 'pending',
  REJECTED: 'rejected',
}

export function AgencyLayout({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation()
  const agency = useAgency() as { data?: Agency }
  const status = agency.data?.status

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-900/20 bg-ink-700">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <Logo variant="mark" size={26} />
            <div>
              <p className="leading-tight font-bold text-neutral-0">
                {agency.data?.name ?? 'MOTOBOY'}
              </p>
              {agency.data?.reference === undefined ? null : (
                <p className="text-xs text-neutral-0/60">{agency.data.reference}</p>
              )}
            </div>
            {status === undefined ? null : (
              <Badge
                label={t(`agency:nav.status.${STATUS_KEYS[status] ?? 'pending'}`)}
                tone={STATUS_TONES[status] ?? 'neutral'}
              />
            )}
          </div>

          <div className="flex items-center gap-4">
            <LocaleSwitch className="text-neutral-0" />
            <button
              type="button"
              onClick={onSignOut}
              className="text-sm text-neutral-0/80 hover:text-neutral-0"
            >
              {t('agency:nav.signOut')}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 lg:flex-row">
        {/*
          **Une seule arborescence, deux mises en forme.** Rendre une barre
          latérale *et* une rangée d'onglets, chacune masquée à son tour par
          CSS, met les mêmes liens deux fois dans le document : un lecteur
          d'écran les annonce tous les deux, et une recherche par rôle en
          trouve deux.
        */}
        <nav className="-mx-6 flex shrink-0 gap-1 overflow-x-auto px-6 pb-1 lg:mx-0 lg:w-56 lg:flex-col lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">
          {GROUPS.map((group) => (
            <div key={group.key} className="contents lg:flex lg:flex-col lg:gap-1">
              {/*
                L'intitulé de groupe n'a de sens que dans la colonne : en rangée
                il couperait la lecture au lieu de l'ordonner.
              */}
              <p className="hidden px-3 pb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase lg:block">
                {t(`agency:nav.groups.${group.key}`)}
              </p>
              {group.items.map((item) => (
                <Item key={item.to} to={item.to} icon={item.icon}>
                  {t(`agency:nav.${item.key}`)}
                </Item>
              ))}
            </div>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {status === 'PENDING' ? <PendingNotice /> : null}
          <Outlet />
        </div>
      </div>
    </div>
  )
}

/**
 * Ce que l'attente permet, et ce qu'elle retient.
 *
 * **Sans cette bande, l'espace se lit comme cassé.** Une agence y déclare ses
 * gares et son parc, génère ses départs — et ne les trouve pas dans la
 * recherche. Sans explication, elle recommence, puis conclut à une panne. Le
 * dire une fois, en haut, coûte trois lignes.
 */
function PendingNotice() {
  const { t } = useTranslation()

  return (
    <div className="mb-6 flex gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
      <span className="mt-0.5 shrink-0 text-brand-600">
        <Icon name="alert" size={18} />
      </span>
      <div>
        <p className="text-sm font-semibold text-brand-700">
          {t('agency:nav.status.pendingTitle')}
        </p>
        <p className="mt-0.5 text-sm text-neutral-700">
          {t('agency:nav.status.pendingBody')}
        </p>
      </div>
    </div>
  )
}

function Item({
  to,
  icon,
  children,
}: {
  to: string
  icon: IconName
  children: ReactNode
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors ${
          isActive
            ? 'bg-neutral-0 font-semibold text-ink-700 shadow-sm ring-1 ring-neutral-200'
            : 'text-neutral-700 hover:bg-neutral-0/70'
        }`
      }
    >
      <Icon name={icon} size={16} />
      {children}
    </NavLink>
  )
}
