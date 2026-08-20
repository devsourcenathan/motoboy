import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { unwrap } from '@motoboy/api-client'
import { formatMoney } from '@motoboy/shared'
import { api } from '../../lib/api'
import { describeError } from '../../lib/errors'
import { Card, ErrorNote, Skeleton } from '../../shared/ui'

/**
 * Le détail d'un départ, publiquement.
 *
 * **Une page par départ, avec sa propre adresse** : c'est ce qui se partage dans
 * un message et ce que les moteurs de recherche indexent. Une recherche entière
 * cachée derrière un état de composant n'existe pour personne d'autre que celui
 * qui l'a faite.
 *
 * Aucune action ici : la réservation vit dans l'application. Cette page informe.
 */
export function TripPage() {
  const { reference = '' } = useParams()

  const trip = useQuery({
    queryKey: ['trip', reference],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/trips/{reference}', {
          params: { path: { reference } },
          signal,
        }),
      ),
  })

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-ink-700 px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="font-bold text-neutral-0">
            MOTOBOY
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-6">
        {trip.isPending ? <Skeleton rows={4} /> : null}
        {trip.error ? <ErrorNote message={describeError(trip.error)} /> : null}

        {trip.data === undefined ? null : (
          <>
            <Card>
              <p className="text-sm text-neutral-500">{trip.data.agency.name}</p>
              <h1 className="mt-1 text-2xl font-bold text-ink-700">
                {trip.data.origin_station.city} → {trip.data.destination_station.city}
              </h1>
              <p className="mt-2 text-neutral-700">
                {new Date(trip.data.departure_at).toLocaleString('fr', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}
              </p>

              <dl className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <Row label="Gare de départ" value={trip.data.origin_station.name} />
                <Row label="Gare d’arrivée" value={trip.data.destination_station.name} />
                <Row label="Prix" value={formatMoney(trip.data.price, 'fr')} />
                <Row label="Places restantes" value={String(trip.data.seats_available)} />
              </dl>
            </Card>

            <p className="text-center text-sm text-neutral-500">
              Réservez depuis l’application MOTOBOY — la place n’est tenue qu’une fois la
              réservation faite.
            </p>
          </>
        )}
      </main>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-neutral-100 pb-1">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
