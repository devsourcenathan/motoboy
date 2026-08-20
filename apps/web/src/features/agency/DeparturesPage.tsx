import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '@motoboy/shared'
import { describeError } from '../../lib/errors'
import {
  Button,
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  Panel,
  Skeleton,
  Table,
} from '../../shared/ui'
import { useAgencyTrips, useCancelTrip } from './useOperations'

/** Les motifs que l'administration compte. Du texte libre ne se compterait pas. */
const REASONS = [
  { value: 'BREAKDOWN', labelKey: 'vehicleBreakdown' },
  { value: 'INSUFFICIENT_PASSENGERS', labelKey: 'notEnoughPassengers' },
  { value: 'ROAD_CLOSED', labelKey: 'roadClosed' },
  { value: 'OTHER', labelKey: 'other' },
] as const

/**
 * Les départs de l'agence.
 *
 * **Ce que le passager voit.** Un départ généré ici apparaît dans la recherche ;
 * un départ annulé rembourse tout le monde. C'est donc l'écran qu'une agence
 * ouvre le matin, et celui où une erreur coûte le plus cher.
 */
export function DeparturesPage() {
  const { t } = useTranslation()
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10))
  const trips = useAgencyTrips({ from })
  const [cancelling, setCancelling] = useState<string | null>(null)

  const rows = trips.data?.data ?? []

  return (
    <div>
      <PageHeader
        title={t('agency:departures.title')}
        subtitle={t('agency:departures.subtitle')}
      />

      <div className="mb-4 max-w-xs">
        <Field label={t('agency:departures.from')}>
          <input
            className={INPUT}
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </Field>
      </div>

      {trips.isPending ? <Skeleton /> : null}
      {trips.error ? <ErrorNote message={describeError(trips.error)} /> : null}

      {trips.data !== undefined && rows.length === 0 ? (
        <EmptyState
          title={t('agency:departures.emptyTitle')}
          body={t('agency:departures.emptyBody')}
        />
      ) : null}

      {rows.length === 0 ? null : (
        <Table
          head={[
            t('agency:departures.head.departure'),
            t('agency:departures.head.route'),
            t('agency:departures.head.price'),
            t('agency:departures.head.seats'),
            t('agency:departures.head.reference'),
            '',
          ]}
        >
          {rows.map((trip) => (
            <tr key={trip.reference}>
              <Cell className="font-medium whitespace-nowrap">
                {new Date(trip.departure_at).toLocaleString('fr', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </Cell>
              <Cell>
                {trip.origin_station.city} → {trip.destination_station.city}
              </Cell>
              <Cell>{formatMoney(trip.price, 'fr')}</Cell>
              <Cell>
                {/*
                  Les places restantes, pas les places vendues : c'est ce qu'on
                  regarde pour décider d'annuler faute d'effectif.
                */}
                <span className={trip.seats_available === 0 ? 'text-danger' : ''}>
                  {trip.seats_available} libre{trip.seats_available > 1 ? 's' : ''}
                </span>
              </Cell>
              <Cell className="font-mono text-neutral-500">{trip.reference}</Cell>
              <Cell>
                <button
                  type="button"
                  className="text-sm font-medium text-danger hover:underline"
                  onClick={() => setCancelling(trip.reference)}
                >
                  Annuler
                </button>
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      {cancelling === null ? null : (
        <CancelPanel reference={cancelling} onClose={() => setCancelling(null)} />
      )}
    </div>
  )
}

function CancelPanel({ reference, onClose }: { reference: string; onClose: () => void }) {
  const { t } = useTranslation()
  const cancel = useCancelTrip()
  const [reason, setReason] = useState<(typeof REASONS)[number]['value']>('BREAKDOWN')
  const [note, setNote] = useState('')

  return (
    <Panel title={`Annuler ${reference}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          cancel.mutate({ reference, reason, note }, { onSuccess: onClose })
        }}
      >
        {/*
          Dit avant de demander le motif, pas après : c'est l'information qui
          décide, et la découvrir une fois le geste fait serait trop tard.
        */}
        <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger-strong">
          Tous les passagers de ce départ seront remboursés intégralement, sans frais, et
          prévenus. L’annulation ne se reprend pas.
        </p>

        <Field
          label={t('agency:departures.reason')}
          hint={t('agency:departures.reasonHint')}
        >
          <select
            className={INPUT}
            value={reason}
            onChange={(event) => setReason(event.target.value as typeof reason)}
          >
            {REASONS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {t(`agency:departures.reasons.${entry.labelKey}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('agency:departures.note')}>
          <textarea
            className={INPUT}
            rows={3}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>

        {cancel.error ? <ErrorNote message={describeError(cancel.error)} /> : null}

        <Button
          type="submit"
          variant="danger"
          label={t('agency:departures.cancel')}
          disabled={cancel.isPending}
        />
      </form>
    </Panel>
  )
}
