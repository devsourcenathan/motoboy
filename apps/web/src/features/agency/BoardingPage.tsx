import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { describeError } from '../../lib/errors'
import {
  Button,
  Card,
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  Skeleton,
  Table,
} from '../../shared/ui'
import { useAgencyTrips, useBoardingList, useValidateTicket } from './useOperations'

/**
 * L'embarquement.
 *
 * **Une liste, pas un scanner.** Le scan appartient à la PWA d'embarquement, qui
 * fonctionne hors ligne sur le quai ; cet écran sert au bureau — vérifier qui est
 * monté, rattraper un billet illisible, contrôler l'effectif avant de fermer les
 * portes.
 *
 * La saisie manuelle est donc **le mode normal ici**, et non un dépannage : sur
 * un poste fixe il n'y a pas de caméra, et refuser de valider sans scan
 * ramènerait l'agent au papier.
 */
export function BoardingPage() {
  const { t } = useTranslation()
  const today = new Date().toISOString().slice(0, 10)
  const trips = useAgencyTrips({ from: today })
  const [reference, setReference] = useState<string | null>(null)

  const rows = trips.data?.data ?? []

  return (
    <div>
      <PageHeader title={t('boarding:title')} subtitle={t('boarding:subtitle')} />

      {trips.isPending ? <Skeleton /> : null}
      {trips.error ? <ErrorNote message={describeError(trips.error)} /> : null}

      {trips.data !== undefined && rows.length === 0 ? (
        <EmptyState title={t('boarding:list.noTripTitle')} />
      ) : null}

      {rows.length === 0 ? null : (
        <>
          <div className="mb-4 max-w-md">
            <Field label={t('boarding:departure')}>
              <select
                className={INPUT}
                value={reference ?? ''}
                onChange={(event) => setReference(event.target.value || null)}
              >
                <option value="">Choisir…</option>
                {rows.map((trip) => (
                  <option key={trip.reference} value={trip.reference}>
                    {new Date(trip.departure_at).toLocaleTimeString('fr', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    — {trip.origin_station.city} → {trip.destination_station.city}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {reference === null ? null : <BoardingList reference={reference} />}
        </>
      )}
    </div>
  )
}

function BoardingList({ reference }: { reference: string }) {
  const { t } = useTranslation()
  const list = useBoardingList(reference)
  const validate = useValidateTicket(reference)
  const [ticket, setTicket] = useState('')

  const passengers = list.data?.passengers ?? []
  // `USED` et non « validé » : c'est l'état du **billet**, et le vocabulaire du
  // contrat vaut mieux qu'une traduction locale qui divergerait.
  const boarded = passengers.filter((passenger) => passenger.status === 'USED').length

  return (
    <div className="space-y-4">
      <Card>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()

            validate.mutate(
              { ticketReference: ticket.trim().toUpperCase(), method: 'MANUAL' },
              { onSuccess: () => setTicket('') },
            )
          }}
        >
          <div className="min-w-56 flex-1">
            <Field
              label={t('boarding:manual.label')}
              hint="Saisie manuelle — le scan se fait sur le quai."
            >
              <input
                className={`${INPUT} font-mono uppercase`}
                value={ticket}
                onChange={(event) => setTicket(event.target.value)}
                placeholder="TCK-XXXXXX"
              />
            </Field>
          </div>
          <Button
            type="submit"
            label={t('boarding:manual.submit')}
            disabled={ticket.trim() === '' || validate.isPending}
          />
        </form>

        {/*
          Le résultat est nommé, jamais réduit à « fait ». Un **doublon** n'est
          pas une erreur de l'agent : c'est un billet déjà validé, et le confondre
          avec un refus le ferait chercher un problème qui n'existe pas.
        */}
        {validate.data === undefined ? null : (
          <ValidationOutcome status={validate.data.results[0]?.status ?? 'REJECTED'} />
        )}
        {validate.error ? (
          <div className="mt-3">
            <ErrorNote message={describeError(validate.error)} />
          </div>
        ) : null}
      </Card>

      {list.isPending ? <Skeleton /> : null}
      {list.error ? <ErrorNote message={describeError(list.error)} /> : null}

      {list.data === undefined ? null : (
        <>
          <p className="text-sm text-neutral-500">
            {boarded} embarqué{boarded > 1 ? 's' : ''} sur {passengers.length} · liste
            établie à {new Date(list.data.generated_at).toLocaleTimeString('fr')}
          </p>

          {passengers.length === 0 ? (
            <EmptyState
              title={t('boarding:list.emptyTitle')}
              body={t('boarding:list.emptyBody')}
            />
          ) : (
            <Table
              head={[
                t('boarding:list.passenger'),
                t('boarding:list.seat'),
                t('boarding:list.ticket'),
                t('boarding:list.status'),
              ]}
            >
              {passengers.map((passenger) => (
                <tr key={passenger.ticket_reference}>
                  <Cell className="font-medium">
                    {passenger.passenger_name}
                    {passenger.group_size !== undefined && passenger.group_size > 1 ? (
                      <span className="ml-2 text-xs text-neutral-500">
                        groupe de {passenger.group_size}
                      </span>
                    ) : null}
                  </Cell>
                  <Cell>{passenger.seat_label ?? '—'}</Cell>
                  <Cell className="font-mono text-neutral-500">
                    {passenger.ticket_reference}
                  </Cell>
                  <Cell>
                    {passenger.status === 'USED' ? (
                      <span className="rounded-full bg-success-50 px-2 py-1 text-xs text-success-700">
                        {t('boarding:list.boarded')}
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
                        {t('boarding:list.expected')}
                      </span>
                    )}
                  </Cell>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Le résultat d'une validation, nommé.
 *
 * Trois issues distinctes, et les fondre ferait perdre l'information qui compte :
 * un doublon signale un billet déjà passé — donc peut-être une fraude, peut-être
 * un simple double scan — là où un refus signale un billet qui n'a rien à faire
 * sur ce départ.
 */
function ValidationOutcome({
  status,
}: {
  status: 'ACCEPTED' | 'DUPLICATE' | 'REJECTED'
}) {
  if (status === 'ACCEPTED') {
    return (
      <p className="mt-3 rounded-lg bg-success-50 p-3 text-sm text-success-700">
        Billet validé — le passager peut monter.
      </p>
    )
  }

  if (status === 'DUPLICATE') {
    return (
      <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
        Déjà validé. Vérifiez qu’il ne s’agit pas d’un second passager avec le même
        billet.
      </p>
    )
  }

  return (
    <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger-strong">
      Billet refusé — il n’appartient pas à ce départ, ou il a été annulé.
    </p>
  )
}
