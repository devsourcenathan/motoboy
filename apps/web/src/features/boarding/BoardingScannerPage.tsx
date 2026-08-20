import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { describeError } from '../../lib/errors'
import { Button, Card, ErrorNote, Field, INPUT, LocaleSwitch } from '../../shared/ui'
import { referenceFrom } from './offline'
import { Scanner } from './Scanner'
import { scanningSupported } from './scanning'
import { useOfflineBoarding, useOnline } from './useOfflineBoarding'

type Outcome =
  | { kind: 'ACCEPTED'; name: string; seat: string | null }
  | { kind: 'ALREADY_QUEUED'; name: string }
  | { kind: 'ALREADY_USED'; name: string }
  | { kind: 'UNKNOWN'; reference: string }

/**
 * L'embarquement sur le quai.
 *
 * **Conçu pour un endroit sans réseau.** Le wifi d'une gare routière est absent
 * ou ment, et un embarquement qui dépend du serveur s'arrête au premier trou —
 * avec cinquante personnes qui attendent. L'agent télécharge donc la liste au
 * bureau, valide contre elle sur le quai, et synchronise au retour.
 *
 * L'écran obéit à une contrainte simple : **il se lit à bout de bras, au soleil,
 * en tenant un téléphone d'une main**. D'où le verdict en pleine largeur, en
 * couleur, avec le nom du passager — pas une ligne de tableau.
 */
export function BoardingScannerPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const reference = params.get('trip') ?? ''

  const online = useOnline()
  const boarding = useOfflineBoarding(reference)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [manual, setManual] = useState('')

  const submit = useCallback(
    (payload: string, method: 'SCAN' | 'MANUAL') => {
      const ticket = referenceFrom(payload)

      if (ticket === null) return

      const result = boarding.validate(ticket, method)

      setOutcome(
        result.outcome === 'UNKNOWN'
          ? { kind: 'UNKNOWN', reference: ticket }
          : result.outcome === 'ACCEPTED'
            ? {
                kind: 'ACCEPTED',
                name: result.passenger.passenger_name,
                seat: result.passenger.seat_label ?? null,
              }
            : { kind: result.outcome, name: result.passenger.passenger_name },
      )
    },
    [boarding],
  )

  /*
   * Le verdict s'efface tout seul : l'agent enchaîne les passagers, et un écran
   * qu'il faut acquitter à chaque billet ajoute un geste par personne.
   */
  useEffect(() => {
    if (outcome === null) return

    const timer = globalThis.setTimeout(() => setOutcome(null), 2500)

    return () => globalThis.clearTimeout(timer)
  }, [outcome])

  const list = boarding.stored
  const boarded = (list?.list.passengers ?? []).filter((p) => p.status === 'USED').length

  return (
    <main className="mx-auto min-h-screen max-w-lg space-y-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink-700">{t('boarding:title')}</h1>

        {/*
          Le choix de la langue vit ici et nulle part ailleurs : la PWA
          s'installe seule sur l'écran d'accueil d'un agent, souvent hors réseau,
          et rien ne lui permettrait d'aller le chercher sur une autre page.
        */}
        <LocaleSwitch className="text-ink-700" />
        {/*
          L'état du réseau est visible en permanence : c'est lui qui explique
          pourquoi la file grandit, et sans lui l'agent croit à une panne.
        */}
        <span
          className={
            online
              ? 'rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-700'
              : 'rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700'
          }
        >
          {online ? t('boarding:network.online') : t('boarding:network.offline')}
        </span>
      </header>

      <Card>
        <Field label={t('boarding:trip.reference')}>
          <input
            className={`${INPUT} font-mono uppercase`}
            value={reference}
            onChange={(event) => setParams({ trip: event.target.value.toUpperCase() })}
            placeholder="TR-XXXXXX"
          />
        </Field>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            label={
              boarding.downloading
                ? t('boarding:trip.downloading')
                : t('boarding:trip.download')
            }
            onPress={() => void boarding.download()}
            disabled={reference === '' || boarding.downloading || !online}
            variant="secondary"
          />

          {list === null ? null : (
            <span className="text-sm text-neutral-500">
              {boarded}/{list.list.passengers.length} embarqués · copie de{' '}
              {new Date(list.downloadedAt).toLocaleTimeString('fr')}
            </span>
          )}
        </div>

        {boarding.error ? (
          <div className="mt-3">
            <ErrorNote message={describeError(boarding.error)} />
          </div>
        ) : null}
      </Card>

      {list === null ? (
        <Card>
          <p className="text-sm text-neutral-500">{t('boarding:trip.downloadFirst')}</p>
        </Card>
      ) : (
        <>
          {outcome === null ? null : <Verdict outcome={outcome} />}

          {scanningSupported() ? (
            <Scanner onScan={(payload) => submit(payload, 'SCAN')} />
          ) : null}

          <Card>
            <form
              className="flex items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                submit(manual, 'MANUAL')
                setManual('')
              }}
            >
              <div className="flex-1">
                <Field
                  label={t('boarding:manual.label')}
                  hint={scanningSupported() ? undefined : t('boarding:manual.noCamera')}
                >
                  <input
                    className={`${INPUT} font-mono uppercase`}
                    value={manual}
                    onChange={(event) => setManual(event.target.value)}
                    placeholder="TCK-XXXXXX"
                  />
                </Field>
              </div>
              <Button
                type="submit"
                label={t('boarding:manual.submit')}
                disabled={manual.trim() === ''}
              />
            </form>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                <span className="font-semibold">{boarding.queue.length}</span> validation
                {boarding.queue.length > 1 ? 's' : ''} en attente d’envoi
              </p>
              <Button
                label={
                  boarding.syncing
                    ? t('boarding:queue.syncing')
                    : t('boarding:queue.sync')
                }
                onPress={() => void boarding.sync()}
                disabled={boarding.queue.length === 0 || boarding.syncing || !online}
              />
            </div>
            {boarding.queue.length === 0 ? null : (
              <p className="mt-2 text-xs text-neutral-500">
                {t('boarding:queue.warning')}
              </p>
            )}
          </Card>
        </>
      )}
    </main>
  )
}

/**
 * Le verdict, en grand.
 *
 * **Quatre issues, quatre couleurs.** Un agent qui embarque cinquante personnes
 * ne lit pas une phrase : il voit vert ou rouge. Le nom sert au contrôle — c'est
 * ce qu'il compare au visage devant lui — et le siège lui évite d'être rappelé
 * trois rangs plus loin.
 */
function Verdict({ outcome }: { outcome: Outcome }) {
  const { t } = useTranslation()
  if (outcome.kind === 'ACCEPTED') {
    return (
      <div className="rounded-xl bg-success-500 p-5 text-center text-neutral-0">
        <p className="text-3xl font-bold">{t('boarding:outcome.accepted')}</p>
        <p className="mt-1 text-lg">{outcome.name}</p>
        {outcome.seat === null ? null : (
          <p className="text-sm opacity-90">
            {t('boarding:outcome.seat', { seat: outcome.seat })}
          </p>
        )}
      </div>
    )
  }

  if (outcome.kind === 'UNKNOWN') {
    return (
      <div className="rounded-xl bg-danger p-5 text-center text-neutral-0">
        <p className="text-3xl font-bold">{t('boarding:outcome.notOnThisTrip')}</p>
        <p className="mt-1 font-mono text-sm">{outcome.reference}</p>
      </div>
    )
  }

  /*
   * Déjà passé : ni un oui ni un refus. Ce peut être un double scan de l'agent
   * comme un second passager avec le même billet — c'est à lui de regarder, et
   * l'écran doit l'y inviter plutôt que trancher à sa place.
   */
  return (
    <div className="rounded-xl bg-brand-500 p-5 text-center text-neutral-0">
      <p className="text-3xl font-bold">{t('boarding:outcome.alreadyBoarded')}</p>
      <p className="mt-1 text-lg">{outcome.name}</p>
      <p className="text-sm opacity-90">{t('boarding:outcome.checkSecondPerson')}</p>
    </div>
  )
}
