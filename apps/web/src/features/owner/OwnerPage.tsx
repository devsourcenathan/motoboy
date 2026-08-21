import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { unwrap } from '@motoboy/api-client'
import { api } from '../../lib/api'
import { describeError } from '../../lib/errors'
import {
  Badge,
  Card,
  Cell,
  EmptyState,
  ErrorNote,
  PageHeader,
  Skeleton,
  Table,
} from '../../shared/ui'

/**
 * L'espace du propriétaire de véhicule (I3).
 *
 * **En consultation seule, et aucune page ne parle d'argent.** Le propriétaire
 * loue son véhicule à une agence ; sa rémunération se règle directement avec
 * elle. Lui montrer un solde ou un bouton laisserait croire que la plateforme
 * porte ce flux — elle ne le porte pas, et l'ambiguïté se paierait en réclamations
 * adressées au mauvais interlocuteur.
 *
 * Ce qu'il vient vérifier tient en une question : **son véhicule roule-t-il ?**
 * D'où le taux de remplissage en évidence, qui est ce dont on discute avec
 * l'agence.
 */
export function OwnerPage() {
  const vehicles = useQuery({
    queryKey: ['owner', 'vehicles'],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/owner/vehicles', { signal })),
  })

  const [selected, setSelected] = useState<number | null>(null)

  const rows = vehicles.data?.data ?? []

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-ink-700 px-6 py-3">
        <p className="mx-auto max-w-4xl font-bold text-neutral-0">
          MOTOBOY — mes véhicules
        </p>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        <PageHeader
          title="Mes véhicules"
          subtitle="Les départs qu’ils ont assurés et leur remplissage. Votre rémunération se règle directement avec l’agence."
        />

        {vehicles.isPending ? <Skeleton /> : null}
        {vehicles.error ? <ErrorNote message={describeError(vehicles.error)} /> : null}

        {vehicles.data !== undefined && rows.length === 0 ? (
          <EmptyState
            title="Aucun véhicule"
            body="Une agence vous rattache un véhicule par votre numéro de téléphone. Rapprochez-vous d’elle si vous pensez qu’il manque."
          />
        ) : null}

        <div className="space-y-3">
          {rows.map((vehicle) => (
            <Card key={vehicle.id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono font-semibold text-neutral-900">
                    {vehicle.registration}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {[vehicle.brand, vehicle.model].filter(Boolean).join(' ') ||
                      vehicle.type}{' '}
                    · {vehicle.capacity} places
                    {vehicle.agency === null ? '' : ` · exploité par ${vehicle.agency}`}
                  </p>
                </div>

                <button
                  type="button"
                  className="text-sm font-medium text-brand-600 hover:underline"
                  onClick={() => setSelected(selected === vehicle.id ? null : vehicle.id)}
                >
                  {selected === vehicle.id ? 'Masquer les départs' : 'Voir les départs'}
                </button>
              </div>

              {selected === vehicle.id ? <OwnerTrips vehicleId={vehicle.id} /> : null}
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}

function OwnerTrips({ vehicleId }: { vehicleId: number }) {
  const trips = useQuery({
    queryKey: ['owner', 'vehicles', vehicleId, 'trips'],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/owner/vehicles/{vehicle}/trips', {
          params: { path: { vehicle: vehicleId } },
          signal,
        }),
      ),
  })

  const rows = trips.data?.data ?? []

  return (
    <div className="mt-4">
      {trips.isPending ? <Skeleton rows={3} /> : null}
      {trips.error ? <ErrorNote message={describeError(trips.error)} /> : null}

      {trips.data !== undefined && rows.length === 0 ? (
        <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500">
          Aucun départ assuré pour l’instant.
        </p>
      ) : null}

      {rows.length === 0 ? null : (
        <Table head={['Départ', 'Places vendues', 'Remplissage', 'État']}>
          {rows.map((trip) => (
            <tr key={trip.reference}>
              <Cell className="whitespace-nowrap">
                {trip.departure_at === null
                  ? '—'
                  : new Date(trip.departure_at).toLocaleDateString('fr', {
                      dateStyle: 'medium',
                    })}
              </Cell>
              <Cell>
                {trip.seats_sold} / {trip.capacity}
              </Cell>
              <Cell>
                {/*
                  Une barre autant qu'un chiffre : c'est ce qui se compare d'un
                  regard sur vingt lignes, et le chiffre seul oblige à lire.
                */}
                <span className="flex items-center gap-2">
                  <span className="h-2 w-24 overflow-hidden rounded-full bg-neutral-200">
                    <span
                      className="block h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.min(100, trip.fill_rate)}%` }}
                    />
                  </span>
                  <span className="text-sm font-medium">{trip.fill_rate} %</span>
                </span>
              </Cell>
              <Cell>
                {trip.status === 'CANCELLED' ? (
                  <Badge label="Annulé" tone="alert" />
                ) : (
                  <Badge label="Parti" />
                )}
              </Cell>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
