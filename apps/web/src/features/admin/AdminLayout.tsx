import { NavLink, Outlet } from 'react-router'
import type { ReactNode } from 'react'
import { useCurrentUser, useSignOut } from '../auth/useAuth'
import { Badge, Icon, Logo, type IconName } from '../../shared/ui'

/**
 * La coquille de l'administration.
 *
 * **Neuf onglets alignés ne se lisent pas, ils défilent** — le même défaut que
 * l'espace agence, corrigé de la même façon. « Réglages » et « Journal » vivaient
 * hors du champ sur un portable, et ce qui défile hors de l'écran cesse
 * d'exister.
 *
 * Le groupement suit ce que l'administrateur **fait**, non le type des données :
 *
 * - *Décider* : les quatre files où quelqu'un attend une réponse.
 * - *Suivre* : ce qu'on lit sans rien changer.
 * - *Régler* : ce qu'on touche rarement, et jamais dans l'urgence.
 *
 * Séparer les deux premières est l'essentiel : mêlées, il faut relire la barre
 * entière pour retrouver ce qui appelle un geste — exactement ce que le tableau
 * de bord évite déjà pour ses chiffres.
 *
 * L'administration reste en **français seul** : décision du brief, c'est un
 * outil interne. D'où les libellés écrits ici plutôt que passés par le
 * catalogue, contrairement à l'espace agence.
 */
type Item = { readonly to: string; readonly label: string; readonly icon: IconName }

const GROUPS: readonly { readonly title: string; readonly items: readonly Item[] }[] = [
  {
    title: 'Décider',
    items: [
      { to: '/admin/agencies', label: 'Agences', icon: 'agencies' },
      { to: '/admin/drivers', label: 'Chauffeurs', icon: 'drivers' },
      { to: '/admin/payouts', label: 'Reversements', icon: 'payouts' },
      { to: '/admin/payout-accounts', label: 'Comptes de versement', icon: 'money' },
    ],
  },
  {
    title: 'Suivre',
    items: [
      { to: '/admin/dashboard', label: 'Tableau de bord', icon: 'trips' },
      { to: '/admin/support', label: 'Suivi', icon: 'tickets' },
      { to: '/admin/audit', label: 'Journal', icon: 'document' },
    ],
  },
  {
    title: 'Régler',
    items: [
      { to: '/admin/moderation', label: 'Référentiel', icon: 'agencies' },
      { to: '/admin/settings', label: 'Réglages', icon: 'check' },
    ],
  },
]

export function AdminLayout() {
  const signOut = useSignOut()
  const me = useCurrentUser()

  const name = [me.data?.first_name, me.data?.last_name].filter(Boolean).join(' ')

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-900/20 bg-ink-700">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <Logo variant="mark" size={26} />
            <div>
              <p className="leading-tight font-bold text-neutral-0">MOTOBOY</p>
              <p className="text-xs text-neutral-0/60">Administration</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/*
              **Qui je suis, et avec quels droits.** Un `SUPER_ADMIN` et un
              `ADMIN` voient la même barre alors qu'ils ne peuvent pas les mêmes
              choses : sans cette mention, un refus sur les réglages se lit comme
              une panne plutôt que comme un manque de droits.
            */}
            {name === '' ? null : (
              <span className="flex items-center gap-2 text-sm text-neutral-0/80">
                {name}
                {me.data?.roles.includes('SUPER_ADMIN') ? (
                  <Badge label="Super-admin" tone="good" />
                ) : null}
              </span>
            )}
            <button
              type="button"
              onClick={() => signOut.mutate()}
              className="text-sm text-neutral-0/80 hover:text-neutral-0"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 lg:flex-row">
        {/*
          Une seule arborescence, deux mises en forme : une colonne au large,
          une rangée qui défile en dessous. Rendre les deux mettrait les mêmes
          liens deux fois dans le document, et un lecteur d'écran les annoncerait
          tous les deux.
        */}
        <nav className="-mx-6 flex shrink-0 gap-1 overflow-x-auto px-6 pb-1 lg:mx-0 lg:w-60 lg:flex-col lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">
          {GROUPS.map((group) => (
            <div key={group.title} className="contents lg:flex lg:flex-col lg:gap-1">
              <p className="hidden px-3 pb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase lg:block">
                {group.title}
              </p>
              {group.items.map((item) => (
                <Item key={item.to} to={item.to} icon={item.icon}>
                  {item.label}
                </Item>
              ))}
            </div>
          ))}
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
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
