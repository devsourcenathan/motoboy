import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { unwrap } from '@motoboy/api-client'
import { formatMoney } from '@motoboy/shared'
import { api } from '../../lib/api'
import { describeError } from '../../lib/errors'

/**
 * « Où en est ma course ? » (A4).
 *
 * Le support reçoit un appel et une référence — parfois celle de la demande,
 * parfois celle de la course, l'appelant ne faisant pas la différence. Les deux
 * entrent : imposer la bonne reviendrait à demander à quelqu'un d'inquiet de
 * comprendre un découpage interne avant d'être aidé.
 *
 * **En lecture seule.** Le support constate, il ne décide pas : annuler ou
 * rembourser depuis cet écran contournerait les gardes des Actions — celles qui
 * refusent de démarrer une course impayée ou de rembourser deux fois.
 */
export function SupportLookupPage() {
  const [input, setInput] = useState('')
  const [reference, setReference] = useState<string | null>(null)

  const lookup = useQuery({
    queryKey: ['support', reference],
    // Une recherche ne part qu'une fois la référence validée : lancer un appel à
    // chaque frappe interrogerait l'API sur des références tronquées.
    enabled: reference !== null,
    retry: false,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/admin/service-requests/{reference}', {
          params: { path: { reference: reference ?? '' } },
          signal,
        }),
      ),
  })

  const data = lookup.data
  const ride = data?.ride ?? null

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink-700">Suivi d’une course</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Référence de demande (SRV-…) ou de course (RID-…) — les deux fonctionnent.
        </p>
      </header>

      <form
        className="mb-6 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setReference(input.trim().toUpperCase())
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="SRV-XXXXXX"
          className="w-64 rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm uppercase"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-0 hover:bg-brand-600"
        >
          Chercher
        </button>
      </form>

      {lookup.isFetching ? <p className="text-sm text-neutral-500">Recherche…</p> : null}

      {lookup.error ? (
        <p className="text-sm whitespace-pre-line text-danger">{describeError(lookup.error)}</p>
      ) : null}

      {data === undefined ? null : (
        <div className="space-y-4">
          <section className="rounded-xl bg-neutral-0 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-mono font-semibold">{data.reference}</h2>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold">
                {data.status}
              </span>
            </div>

            <p className="mt-3 text-sm">
              <strong>{data.origin.city ?? '—'}</strong>
              {data.origin.landmark === null ? '' : ` (${data.origin.landmark})`}
              {' → '}
              <strong>{data.destination.city ?? '—'}</strong>
              {data.destination.landmark === null ? '' : ` (${data.destination.landmark})`}
            </p>

            <p className="mt-2 text-sm text-neutral-500">
              {data.passengers} passager{data.passengers > 1 ? 's' : ''}
              {' · expire le '}
              {new Date(data.expires_at).toLocaleString('fr')}
            </p>

            {data.note === null ? null : (
              <p className="mt-2 rounded-lg bg-neutral-50 p-3 text-sm">{data.note}</p>
            )}
          </section>

          {/*
            Les offres restent visibles même après acceptation : le support doit
            pouvoir répondre à « pourquoi ce prix ? », et la réponse est ce que
            les autres chauffeurs proposaient au même moment.
          */}
          {data.offers === undefined || data.offers.length === 0 ? null : (
            <section className="rounded-xl bg-neutral-0 p-5 shadow-sm">
              <h2 className="mb-3 font-semibold">Offres reçues</h2>
              <ul className="space-y-2 text-sm">
                {data.offers.map((offer) => (
                  <li key={offer.id} className="flex justify-between border-b border-neutral-100 pb-2">
                    <span>
                      {offer.driver.first_name} · {offer.eta_minutes} min
                    </span>
                    <span className="flex gap-3">
                      <span className="font-semibold">{formatMoney(offer.price, 'fr')}</span>
                      <span className="text-neutral-500">{offer.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ride === null || ride === undefined ? null : (
            <section className="rounded-xl bg-neutral-0 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-mono font-semibold">{ride.reference}</h2>
                <span
                  className={
                    ride.paid
                      ? 'rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-700'
                      : 'rounded-full bg-danger-soft px-3 py-1 text-xs font-semibold text-danger-strong'
                  }
                >
                  {ride.paid ? 'Payée' : 'Non payée'} · {ride.status}
                </span>
              </div>

              <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between border-b border-neutral-100 pb-1">
                  <dt className="text-neutral-500">Chauffeur</dt>
                  <dd className="font-medium">
                    {[ride.driver.first_name, ride.driver.last_name].filter(Boolean).join(' ')}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-neutral-100 pb-1">
                  <dt className="text-neutral-500">Téléphone</dt>
                  <dd>{ride.driver.phone ?? '—'}</dd>
                </div>
                <div className="flex justify-between border-b border-neutral-100 pb-1">
                  <dt className="text-neutral-500">Véhicule</dt>
                  <dd>{ride.driver.vehicle_plate ?? '—'}</dd>
                </div>
                <div className="flex justify-between border-b border-neutral-100 pb-1">
                  <dt className="text-neutral-500">Prix</dt>
                  <dd className="font-semibold">{formatMoney(ride.price, 'fr')}</dd>
                </div>
              </dl>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
