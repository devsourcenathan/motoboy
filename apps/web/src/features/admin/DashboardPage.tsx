import { formatMoney } from '@motoboy/shared'
import { describeError } from '../../lib/errors'
import { Card, ErrorNote, PageHeader, Skeleton } from '../../shared/ui'
import { useDashboard } from './useAdmin'

type Money = { amount: number; currency: string }

type Dashboard = {
  users?: number
  agencies?: { total?: number; pending?: number; approved?: number }
  trips?: { upcoming?: number }
  bookings?: { confirmed?: number; cancelled?: number }
  tickets_validated?: number
  vehicles_active?: number
  revenue?: Money
  commissions?: Money
  refunds?: Money
  payouts_pending?: Money
}

/**
 * Le tableau de bord.
 *
 * **Deux familles de nombres, et il faut les séparer.** Ceux qui appellent une
 * action — des agences en attente, des reversements à faire — et ceux qui ne font
 * que décrire. Les mêler dans une grille uniforme oblige à relire chaque case
 * pour retrouver celle qui demande quelque chose.
 *
 * L'argent est en bas et non en haut : il rassure, alors que ce qui attend une
 * décision est ce pour quoi on ouvre cette page.
 */
export function DashboardPage() {
  const dashboard = useDashboard()
  const data = dashboard.data as Dashboard | undefined

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle="L’état de la plateforme, à l’instant."
      />

      {dashboard.isPending ? <Skeleton rows={4} /> : null}
      {dashboard.error ? <ErrorNote message={describeError(dashboard.error)} /> : null}

      {data === undefined ? null : (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-2 text-sm font-bold text-ink-700">
              Ce qui attend une décision
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Agences à instruire"
                value={String(data.agencies?.pending ?? 0)}
                urgent={(data.agencies?.pending ?? 0) > 0}
              />
              <Stat
                label="Reversements en attente"
                value={money(data.payouts_pending)}
                urgent={(data.payouts_pending?.amount ?? 0) > 0}
              />
            </div>
            {/*
              **Les chauffeurs en attente manquent ici**, et c'est une lacune de
              l'API : `GET /v1/admin/dashboard` ne les compte pas. C'est aussi la
              raison pour laquelle cette page n'est pas l'accueil du back-office —
              y arriver ferait perdre de vue la seule file qui empêche quelqu'un
              de prendre le volant sans permis vérifié.
            */}
            <p className="mt-2 text-xs text-neutral-500">
              Les dossiers de chauffeur ne sont pas comptés ici. Voir l’onglet «
              Chauffeurs ».
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold text-ink-700">Activité</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Comptes vérifiés" value={String(data.users ?? 0)} />
              <Stat
                label="Agences admises"
                value={String(data.agencies?.approved ?? 0)}
              />
              <Stat label="Départs à venir" value={String(data.trips?.upcoming ?? 0)} />
              <Stat
                label="Réservations confirmées"
                value={String(data.bookings?.confirmed ?? 0)}
              />
              <Stat label="Billets validés" value={String(data.tickets_validated ?? 0)} />
              <Stat label="Véhicules actifs" value={String(data.vehicles_active ?? 0)} />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold text-ink-700">Argent</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Encaissé" value={money(data.revenue)} />
              <Stat label="Commissions" value={money(data.commissions)} />
              {/*
                Les remboursements à côté de l'encaissé, jamais soustraits : deux
                nombres qui bougent pour des raisons différentes, et n'en montrer
                que la différence cacherait une hausse des annulations derrière
                une hausse des ventes.
              */}
              <Stat label="Remboursé" value={money(data.refunds)} />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function money(value: Money | undefined): string {
  return value === undefined ? '—' : formatMoney(value, 'fr')
}

function Stat({
  label,
  value,
  urgent = false,
}: {
  label: string
  value: string
  urgent?: boolean
}) {
  return (
    <Card>
      <p className="text-xs text-neutral-500">{label}</p>
      {/*
        L'orange dit « votre action », et seulement elle : il ne colore donc que
        les compteurs qui attendent un geste, et uniquement quand ils ne sont pas
        à zéro. Un zéro en orange crierait sans rien demander.
      */}
      <p
        className={
          urgent
            ? 'text-2xl font-bold text-orange-500'
            : 'text-2xl font-bold text-ink-700'
        }
      >
        {value}
      </p>
    </Card>
  )
}
