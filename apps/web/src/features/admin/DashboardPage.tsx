import { formatMoney } from '@motoboy/shared'
import { Link } from 'react-router'
import { describeError } from '../../lib/errors'
import {
  Card,
  CardHeader,
  ErrorNote,
  Icon,
  PageHeader,
  Section,
  SkeletonCards,
  SkeletonText,
  StatCard,
  type Tone,
} from '../../shared/ui'
import { useAuditLogs, useDashboard } from './useAdmin'

type Money = { amount: number; currency: string }

type Dashboard = {
  users?: number
  agencies?: { total?: number; pending?: number; approved?: number }
  trips?: { upcoming?: number; cancelled_30d?: number }
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
 * action — des agences en attente, des reversements à faire — et ceux qui ne
 * font que décrire. Les mêler dans une grille uniforme oblige à relire chaque
 * case pour retrouver celle qui demande quelque chose.
 *
 * Trois choses distinguent cette version de la précédente, et aucune n'est
 * décorative :
 *
 * - **Ce qui attend une décision est cliquable.** Un compteur qui annonce trois
 *   agences à instruire sans mener à la file oblige à retrouver l'onglet
 *   soi-même — et l'on finit par ne plus ouvrir cette page.
 * - **Les annulations de départ apparaissent.** L'API les comptait déjà
 *   (`trips.cancelled_30d`) et **rien ne les affichait** : une agence qui annule
 *   un départ sur cinq détruit la confiance dans la plateforme entière, pas
 *   seulement dans sa propre offre.
 * - **Les nombres portent leur dénominateur.** « 9 » ne s'interprète pas ;
 *   « 9 — sur 14 agences » se lit sans aller chercher ailleurs.
 *
 * L'argent reste en bas : il rassure, alors que ce qui attend une décision est
 * ce pour quoi on ouvre cette page.
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

      {dashboard.error ? <ErrorNote message={describeError(dashboard.error)} /> : null}

      {dashboard.isPending ? (
        <div className="flex flex-col gap-8">
          <SkeletonCards count={3} columns={3} />
          <SkeletonCards count={4} columns={4} />
        </div>
      ) : null}

      {data === undefined ? null : (
        <div className="flex flex-col gap-8">
          <Decisions data={data} />
          <Activity data={data} />
          <Money data={data} />
          <RecentDecisions />
        </div>
      )}
    </div>
  )
}

/**
 * Ce qui attend un geste.
 *
 * L'orange dit « votre action », et seulement elle — d'où le repli sur le ton
 * neutre quand le compteur est à zéro : **un zéro en orange crierait sans rien
 * demander**, et l'on cesserait de croire la couleur.
 */
function Decisions({ data }: { data: Dashboard }) {
  const agencies = data.agencies?.pending ?? 0
  const payouts = data.payouts_pending?.amount ?? 0
  const cancelled = data.trips?.cancelled_30d ?? 0

  return (
    <Section
      title="Ce qui attend une décision"
      hint="Les dossiers de chauffeur ne sont pas comptés ici : l’API ne les renvoie pas. C’est aussi pourquoi la file des chauffeurs reste la page d’accueil."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Agences à instruire"
          value={String(agencies)}
          hint={total(data.agencies?.total, 'agence', 'agences')}
          icon="agencies"
          tone={tone(agencies > 0)}
          to={agencies > 0 ? '/admin/agencies' : undefined}
        />
        <StatCard
          label="Reversements en attente"
          value={money(data.payouts_pending)}
          hint="Montant net, tous statuts en cours confondus"
          icon="payouts"
          tone={tone(payouts > 0)}
          to={payouts > 0 ? '/admin/payouts' : undefined}
        />
        {/*
          **Ce compteur existait dans l'API et n'était affiché nulle part.**
          Seules les annulations de départs portant des réservations confirmées
          y entrent : supprimer un départ généré non vendu relève du planning,
          pas de l'incident.
        */}
        <StatCard
          label="Départs annulés · 30 j"
          value={String(cancelled)}
          hint="Avec des réservations confirmées à bord"
          icon="alert"
          tone={cancelled > 0 ? 'alert' : 'neutral'}
        />
      </div>
    </Section>
  )
}

function Activity({ data }: { data: Dashboard }) {
  const confirmed = data.bookings?.confirmed ?? 0
  const cancelled = data.bookings?.cancelled ?? 0

  return (
    <Section title="Activité">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Comptes vérifiés" value={String(data.users ?? 0)} icon="users" />
        <StatCard
          label="Agences admises"
          value={String(data.agencies?.approved ?? 0)}
          hint={total(data.agencies?.total, 'inscrite', 'inscrites')}
          icon="agencies"
          tone="good"
        />
        <StatCard
          label="Départs à venir"
          value={String(data.trips?.upcoming ?? 0)}
          icon="trips"
        />
        <StatCard
          label="Véhicules actifs"
          value={String(data.vehicles_active ?? 0)}
          icon="trips"
        />
        <StatCard
          label="Réservations confirmées"
          value={String(confirmed)}
          hint={`${cancelled} annulée${cancelled > 1 ? 's' : ''}`}
          icon="tickets"
        />
        <StatCard
          label="Billets validés"
          value={String(data.tickets_validated ?? 0)}
          hint="À l’embarquement, depuis le début"
          icon="check"
          tone="good"
        />
      </div>
    </Section>
  )
}

function Money({ data }: { data: Dashboard }) {
  return (
    <Section title="Argent">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Encaissé" value={money(data.revenue)} icon="money" />
        <StatCard
          label="Commissions"
          value={money(data.commissions)}
          hint="La part MOTOBOY, déjà comprise dans l’encaissé"
          icon="money"
          tone="good"
        />
        {/*
          Les remboursements à côté de l'encaissé, jamais soustraits : deux
          nombres qui bougent pour des raisons différentes, et n'en montrer que
          la différence cacherait une hausse des annulations derrière une hausse
          des ventes.
        */}
        <StatCard
          label="Remboursé"
          value={money(data.refunds)}
          hint="Jamais soustrait de l’encaissé"
          icon="refunds"
        />
      </div>
    </Section>
  )
}

type Entry = {
  id?: number
  action?: string
  auditable_type?: string | null
  auditable_id?: number | null
  created_at?: string | null
}

/**
 * Les dernières décisions.
 *
 * **Un tableau de bord qui ne montre que des totaux ne dit pas ce qui vient de
 * se passer.** Le journal d'audit le sait déjà — chaque admission, chaque
 * commission modifiée y est écrite — et il fallait ouvrir un autre onglet pour
 * le lire. Cinq lignes suffisent à répondre à « quelqu'un a-t-il agi depuis ma
 * dernière visite ».
 *
 * Aucun état d'erreur ici, et c'est délibéré : ce panneau est un complément.
 * S'il échoue, le tableau de bord reste utile, et une alerte rouge pour une
 * liste secondaire ferait douter des chiffres au-dessus, qui eux sont arrivés.
 */
function RecentDecisions() {
  const logs = useAuditLogs('', 1)
  const entries = ((logs.data?.data ?? []) as Entry[]).slice(0, 5)

  return (
    <Card padded={false}>
      <CardHeader
        title="Dernières décisions"
        hint="Ce que l’équipe a tranché, le plus récent d’abord"
        action={
          <Link
            to="/admin/audit"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600"
          >
            Tout le journal
            <Icon name="arrow" size={13} />
          </Link>
        }
      />

      <div className="px-5 py-4">
        {logs.isPending ? <SkeletonText lines={4} /> : null}

        {logs.isPending || entries.length > 0 ? null : (
          <p className="text-sm text-neutral-500">
            Rien encore. Le journal se remplit à la première décision.
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {entries.map((entry, index) => (
            <li
              key={entry.id ?? index}
              className="flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {entry.action ?? '—'}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {entry.auditable_type ?? '—'}
                  {entry.auditable_id === null || entry.auditable_id === undefined
                    ? ''
                    : ` #${entry.auditable_id}`}
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                {entry.created_at ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

function money(value: Money | undefined): string {
  return value === undefined ? '—' : formatMoney(value, 'fr')
}

/** Le ton d'un compteur d'action : neutre à zéro, sinon orange. */
function tone(pending: boolean): Tone {
  return pending ? 'action' : 'neutral'
}

/** « sur 14 agences » — le dénominateur qu'un grand chiffre seul ne donne pas. */
function total(value: number | undefined, one: string, many: string): string | undefined {
  if (value === undefined) return undefined

  return `sur ${value} ${value > 1 ? many : one}`
}
