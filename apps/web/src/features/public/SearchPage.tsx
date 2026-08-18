import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { unwrap } from '@motoboy/api-client'
import { formatMoney } from '@motoboy/shared'
import { api } from '../../lib/api'
import { describeError } from '../../lib/errors'
import { Button, Card, EmptyState, ErrorNote, Field, INPUT, Skeleton } from '../../shared/ui'
import { CityField, type CityChoice } from '../agency/CityField'

/**
 * La recherche publique.
 *
 * **Sans compte, et c'est un choix du brief** (§35) : le premier écran doit
 * fonctionner avant toute inscription. Un tunnel qui demande un compte pour
 * consulter des horaires perd la moitié des gens sur une question qu'ils ne se
 * posaient pas.
 *
 * L'identité est celle du produit, pas celle d'un outil d'administration : fond
 * marine, orange pour l'action, une carte de recherche qui occupe l'écran. C'est
 * la même page que le mobile, sur un écran plus large.
 *
 * **L'état vit dans l'URL.** Une recherche se partage par lien, se recharge sans
 * se perdre, et le bouton retour du navigateur fait ce qu'on attend de lui.
 */
export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const [from, setFrom] = useState<CityChoice | null>(null)
  const [to, setTo] = useState<CityChoice | null>(null)
  const [date, setDate] = useState(params.get('date') ?? new Date().toISOString().slice(0, 10))
  const [passengers, setPassengers] = useState(Number(params.get('passengers') ?? '1'))

  const criteria = {
    origin: params.get('origin'),
    destination: params.get('destination'),
    date: params.get('date'),
    passengers: Number(params.get('passengers') ?? '1'),
  }

  const searching =
    criteria.origin !== null && criteria.destination !== null && criteria.date !== null

  const results = useQuery({
    queryKey: ['search', criteria],
    enabled: searching,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/search', {
          params: {
            query: {
              origin_city_id: Number(criteria.origin),
              destination_city_id: Number(criteria.destination),
              date: criteria.date ?? '',
              passengers: criteria.passengers,
            },
          },
          signal,
        }),
      ),
  })

  const trips = results.data?.data ?? []

  return (
    <div className="min-h-screen bg-page">
      {/*
        Le bandeau marine porte l'identité et la recherche : c'est le premier
        écran, et il doit ressembler à un produit de voyage — pas à une console.
      */}
      <header className="bg-ink-700 px-6 pt-6 pb-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-xl font-bold text-neutral-0">MOTOBOY</p>
          <h1 className="mt-4 max-w-lg text-2xl font-bold text-neutral-0 sm:text-3xl">
            Comparez les départs de toutes les agences, sur un seul écran.
          </h1>
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-4xl px-6 pb-12">
        <Card>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()

              if (from === null || to === null) return

              setParams({
                origin: String(from.id),
                destination: String(to.id),
                date,
                passengers: String(passengers),
              })
            }}
          >
            <CityField label="Départ" value={from} onChange={setFrom} />
            <CityField label="Arrivée" value={to} onChange={setTo} />

            <Field label="Date">
              <input
                className={INPUT}
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>

            <Field label="Voyageurs">
              <input
                className={INPUT}
                type="number"
                min={1}
                max={9}
                value={passengers}
                onChange={(event) => setPassengers(Number(event.target.value))}
              />
            </Field>

            <div className="sm:col-span-2">
              <Button type="submit" label="Chercher" disabled={from === null || to === null} />
            </div>
          </form>
        </Card>

        <div className="mt-6 space-y-3">
          {results.isPending && searching ? <Skeleton /> : null}
          {results.error ? <ErrorNote message={describeError(results.error)} /> : null}

          {results.data !== undefined && trips.length === 0 ? (
            <EmptyState
              title="Aucun départ ce jour-là"
              body="Essayez une date proche, ou une autre ville de la même région."
            />
          ) : null}

          {trips.map((trip) => (
            <Card key={trip.reference}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-neutral-900">
                    {new Date(trip.departure_at).toLocaleTimeString('fr', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {trip.origin_station.city} → {trip.destination_station.city}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {trip.agency.name}
                    {trip.duration_minutes === null || trip.duration_minutes === undefined
                      ? ''
                      : ` · ${Math.round(trip.duration_minutes / 60)} h`}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold text-brand-600">
                    {formatMoney(trip.price, 'fr')}
                  </p>
                  {/*
                    Les places restantes plutôt que la capacité : c'est ce qui
                    décide de réserver maintenant ou plus tard.
                  */}
                  <p className="text-xs text-neutral-500">
                    {trip.seats_available} place{trip.seats_available > 1 ? 's' : ''}
                  </p>
                </div>

                <Button
                  label="Voir"
                  variant="secondary"
                  onPress={() => void navigate(`/trips/${trip.reference}`)}
                />
              </div>
            </Card>
          ))}
        </div>

        {/*
          La réservation se fait sur le téléphone. Le dire ici évite qu'on cherche
          un bouton « réserver » qui n'existe pas sur cette page — le web public
          informe, l'application vend.
        */}
        <p className="mt-8 text-center text-sm text-neutral-500">
          La réservation et le paiement se font depuis l’application MOTOBOY.
        </p>
      </main>
    </div>
  )
}
