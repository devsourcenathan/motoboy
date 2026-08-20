import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { newIdempotencyKey, unwrap } from '@motoboy/api-client'
import { formatMoney } from '@motoboy/shared'
import { api } from '../../lib/api'
import { describeError } from '../../lib/errors'
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  Skeleton,
} from '../../shared/ui'
import { useAgencyTrips, useCounterSale, useTripSeats } from './useOperations'

/**
 * Annuler une réservation apportée au guichet.
 *
 * **La référence vient du passager, pas d'une liste.** Aucun endpoint d'agence ne
 * liste les réservations : la liste d'embarquement rend des références de
 * *billet*, pas de réservation. Le geste réel est donc celui-ci — quelqu'un se
 * présente avec le SMS ou l'écran de son téléphone, et on annule ce qu'il montre.
 *
 * L'annulation est **totale ici**. L'API accepte des `passenger_ids` pour n'annuler
 * qu'une partie d'un groupe, mais choisir lesquels suppose de les avoir sous les
 * yeux — ce que cet écran ne permet pas encore, faute de savoir lire une
 * réservation. Annuler partiellement à l'aveugle serait pire que de ne pas le
 * proposer.
 */
function CancelBooking() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [reference, setReference] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  const cancel = useMutation({
    mutationFn: async ({ booking, key }: { booking: string; key: string }) =>
      unwrap(
        await api.POST('/v1/agency/bookings/{reference}/cancel', {
          params: { path: { reference: booking }, header: { 'Idempotency-Key': key } },
          body: { passenger_ids: [] } as never,
        }),
      ),
    onSuccess: () => {
      setReference('')
      setConfirming(null)
      // Les places redeviennent vendables : la liste des départs porte leur
      // décompte, et la laisser périmée ferait refuser une vente possible.
      void queryClient.invalidateQueries({ queryKey: ['agency', 'trips'] })
    },
  })

  const result = cancel.data as
    { refund?: { amount: number; currency: string } } | undefined

  return (
    <Card>
      <p className="mb-1 font-semibold text-neutral-900">
        {t('agency:counter.cancelSection')}
      </p>
      <p className="mb-3 text-sm text-neutral-500">{t('agency:counter.cancelHelp')}</p>

      {cancel.error ? <ErrorNote message={describeError(cancel.error)} /> : null}

      {result === undefined ? null : (
        <p className="mb-3 text-sm text-success-700">
          {result.refund === undefined
            ? t('agency:counter.cancelled')
            : t('agency:counter.cancelledWithRefund', {
                amount: formatMoney(result.refund, i18n.language as 'fr' | 'en'),
              })}
        </p>
      )}

      <Field label={t('agency:counter.bookingReference')}>
        <input
          className={INPUT}
          value={reference}
          onChange={(event) => {
            setReference(event.target.value.toUpperCase())
            setConfirming(null)
          }}
          placeholder={t('agency:counter.bookingPlaceholder')}
        />
      </Field>

      <div className="mt-3">
        {confirming !== null ? (
          <div className="flex flex-wrap items-center gap-2">
            {/*
              Une confirmation, parce que l'annulation libère les places et
              déclenche un remboursement : ce n'est pas un geste qu'on reprend.
            */}
            <span className="text-sm text-neutral-700">
              {t('agency:counter.confirmQuestion', { reference })}
            </span>
            <Button
              label={t('agency:counter.confirm')}
              variant="danger"
              disabled={cancel.isPending}
              onPress={() =>
                cancel.mutate({ booking: reference.trim(), key: confirming })
              }
            />
            <Button
              label={t('agency:counter.back')}
              variant="secondary"
              onPress={() => setConfirming(null)}
            />
          </div>
        ) : (
          <Button
            label={t('agency:counter.cancelAction')}
            variant="secondary"
            disabled={reference.trim().length < 4}
            /*
             * **Une clé neuve par annulation, pas par composant.** Réutiliser la
             * même ferait passer la seconde annulation pour un rejeu de la
             * première : le serveur rendrait le résultat de l'autre réservation
             * et celle qu'on vise resterait intacte, en ayant l'air annulée.
             *
             * Elle est fixée à l'ouverture de la confirmation et non à l'envoi,
             * pour qu'un second clic après une coupure réseau reste la même
             * opération plutôt qu'un second remboursement.
             */
            onPress={() => setConfirming(newIdempotencyKey())}
          />
        )}
      </div>
    </Card>
  )
}

/**
 * La vente au guichet.
 *
 * **Le seul écran dont la vitesse est une exigence fonctionnelle.** Plus lente
 * que le cahier papier, cette page ne sera pas utilisée — et toute la fiabilité
 * de la disponibilité affichée aux passagers s'effondre avec elle, puisque les
 * places vendues au comptoir n'y figureraient plus (I2).
 *
 * Trois conséquences sur la forme : **tout tient sur un écran**, sans navigation
 * entre étapes ; le départ du jour est présélectionné ; et le nom se saisit
 * pendant que le plan de sièges charge, jamais après.
 */
export function CounterSalePage() {
  const { t } = useTranslation()
  const today = new Date().toISOString().slice(0, 10)
  const trips = useAgencyTrips({ from: today })
  const [reference, setReference] = useState<string | null>(null)

  const rows = trips.data?.data ?? []

  return (
    <div>
      <PageHeader
        title={t('agency:counter.title')}
        subtitle={t('agency:counter.subtitle')}
      />

      <div className="mb-6">
        <CancelBooking />
      </div>

      {trips.isPending ? <Skeleton /> : null}
      {trips.error ? <ErrorNote message={describeError(trips.error)} /> : null}

      {trips.data !== undefined && rows.length === 0 ? (
        <EmptyState
          title={t('agency:counter.emptyTitle')}
          body={t('agency:counter.emptyBody')}
        />
      ) : null}

      {rows.length === 0 ? null : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <p className="mb-3 font-semibold text-neutral-900">
              {t('agency:counter.departure')}
            </p>
            <div className="space-y-1">
              {rows.map((trip) => (
                <button
                  key={trip.reference}
                  type="button"
                  onClick={() => setReference(trip.reference)}
                  className={
                    trip.reference === reference
                      ? 'w-full rounded-lg border border-brand-500 bg-brand-50 px-3 py-2 text-left'
                      : 'w-full rounded-lg border border-transparent px-3 py-2 text-left hover:bg-neutral-50'
                  }
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">
                      {new Date(trip.departure_at).toLocaleTimeString('fr', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {trip.origin_station.city} → {trip.destination_station.city}
                    </span>
                    <span className="text-sm whitespace-nowrap text-neutral-500">
                      {trip.seats_available} libre{trip.seats_available > 1 ? 's' : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {reference === null ? (
            <Card>
              <p className="text-sm text-neutral-500">
                Choisissez un départ pour commencer la vente.
              </p>
            </Card>
          ) : (
            <SaleForm reference={reference} />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * L'apparence d'un siège selon son état.
 *
 * **`HELD` se distingue de `TAKEN`**, et c'est utile précisément au guichet :
 * une place tenue par une réservation en ligne en cours peut se libérer dans
 * quelques minutes. Les confondre ferait dire « complet » à un agent devant un
 * client qui n'aurait qu'à patienter.
 */
function seatClass(
  status: 'AVAILABLE' | 'TAKEN' | 'HELD' | 'UNAVAILABLE',
  chosen: boolean,
) {
  if (chosen) return 'rounded-lg bg-brand-500 py-2 text-sm font-semibold text-neutral-0'

  if (status === 'AVAILABLE') {
    return 'rounded-lg border border-neutral-300 py-2 text-sm hover:bg-neutral-50'
  }

  if (status === 'HELD') {
    return 'rounded-lg border border-dashed border-neutral-300 py-2 text-sm text-neutral-500'
  }

  return 'rounded-lg bg-neutral-200 py-2 text-sm text-neutral-500'
}

function SaleForm({ reference }: { reference: string }) {
  const { t } = useTranslation()
  const seats = useTripSeats(reference)
  const sale = useCounterSale()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [seatId, setSeatId] = useState<number | null>(null)

  const map = seats.data
  const seated = map?.seating_mode === 'SEATED'

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()

          sale.mutate(
            {
              trip_reference: reference,
              passengers: [
                {
                  first_name: firstName.trim(),
                  last_name: lastName.trim(),
                  ...(seatId === null ? {} : { seat_id: seatId }),
                },
              ],
              contact_phone: phone.trim(),
            },
            {
              onSuccess: () => {
                /*
                 * Le formulaire se vide **tout de suite** : au guichet il y a
                 * quelqu'un derrière, et une confirmation qu'il faut fermer avant
                 * la vente suivante coûte le geste de trop qui fait revenir au
                 * cahier.
                 */
                setFirstName('')
                setLastName('')
                setPhone('')
                setSeatId(null)
              },
            },
          )
        }}
      >
        {/*
          Le nom d'abord, le siège ensuite : on peut taper pendant que le plan
          charge, et l'inverse ferait attendre devant un formulaire figé.
        */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('agency:counter.firstName')}>
            <input
              className={INPUT}
              required
              autoFocus
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </Field>
          <Field label={t('agency:counter.lastName')}>
            <input
              className={INPUT}
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </Field>
        </div>

        <Field label={t('agency:counter.phone')} hint={t('agency:counter.phoneHint')}>
          <input
            className={INPUT}
            required
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t('agency:counter.phonePlaceholder')}
          />
        </Field>

        {seats.isPending ? <Skeleton rows={2} /> : null}

        {map === undefined ? null : seated ? (
          <div>
            <p className="text-xs font-medium text-neutral-700">
              Siège — {map.seats_available} libre{map.seats_available > 1 ? 's' : ''}
            </p>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {map.seats.map((seat) => (
                <button
                  key={seat.id}
                  type="button"
                  disabled={seat.status !== 'AVAILABLE'}
                  title={
                    seat.status === 'HELD'
                      ? 'Tenu par une réservation en cours'
                      : undefined
                  }
                  onClick={() => setSeatId(seat.id)}
                  className={seatClass(seat.status, seat.id === seatId)}
                >
                  {seat.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500">
            Véhicule à capacité : aucun siège à attribuer. {map.seats_available} place
            {map.seats_available > 1 ? 's' : ''} restante
            {map.seats_available > 1 ? 's' : ''}.
          </p>
        )}

        {sale.error ? <ErrorNote message={describeError(sale.error)} /> : null}

        {sale.data === undefined ? null : (
          <p className="rounded-lg bg-success-50 p-3 text-sm text-success-700">
            Vendu — {sale.data.booking.reference} ·{' '}
            {formatMoney(sale.data.booking.total, 'fr')}
          </p>
        )}

        <Button
          type="submit"
          label={t('agency:counter.sell')}
          disabled={
            sale.isPending ||
            firstName.trim() === '' ||
            phone.trim() === '' ||
            (seated && seatId === null)
          }
        />
      </form>
    </Card>
  )
}
