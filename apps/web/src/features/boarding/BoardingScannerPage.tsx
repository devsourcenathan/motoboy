import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { describeError } from '../../lib/errors'
import { Button, Card, ErrorNote, Field, INPUT } from '../../shared/ui'
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
        <h1 className="text-lg font-bold text-ink-700">Embarquement</h1>
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
          {online ? 'En ligne' : 'Hors ligne'}
        </span>
      </header>

      <Card>
        <Field label="Référence du départ">
          <input
            className={`${INPUT} font-mono uppercase`}
            value={reference}
            onChange={(event) => setParams({ trip: event.target.value.toUpperCase() })}
            placeholder="TR-XXXXXX"
          />
        </Field>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            label={boarding.downloading ? 'Téléchargement…' : 'Télécharger la liste'}
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
          <p className="text-sm text-neutral-500">
            Téléchargez la liste au bureau, tant que vous avez du réseau. Sur le quai, elle
            suffit à valider les billets.
          </p>
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
                  label="Saisie manuelle"
                  {...(scanningSupported()
                    ? {}
                    : { hint: 'Cet appareil ne sait pas lire les QR : tout passe par ici.' })}
                >
                  <input
                    className={`${INPUT} font-mono uppercase`}
                    value={manual}
                    onChange={(event) => setManual(event.target.value)}
                    placeholder="TCK-XXXXXX"
                  />
                </Field>
              </div>
              <Button type="submit" label="Valider" disabled={manual.trim() === ''} />
            </form>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                <span className="font-semibold">{boarding.queue.length}</span> validation
                {boarding.queue.length > 1 ? 's' : ''} en attente d’envoi
              </p>
              <Button
                label={boarding.syncing ? 'Envoi…' : 'Synchroniser'}
                onPress={() => void boarding.sync()}
                disabled={boarding.queue.length === 0 || boarding.syncing || !online}
              />
            </div>
            {boarding.queue.length === 0 ? null : (
              <p className="mt-2 text-xs text-neutral-500">
                Elles restent sur cet appareil tant qu’elles n’ont pas été envoyées. Ne videz
                pas les données du navigateur avant d’avoir synchronisé.
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
  if (outcome.kind === 'ACCEPTED') {
    return (
      <div className="rounded-xl bg-success-500 p-5 text-center text-neutral-0">
        <p className="text-3xl font-bold">Montez</p>
        <p className="mt-1 text-lg">{outcome.name}</p>
        {outcome.seat === null ? null : <p className="text-sm opacity-90">Siège {outcome.seat}</p>}
      </div>
    )
  }

  if (outcome.kind === 'UNKNOWN') {
    return (
      <div className="rounded-xl bg-danger p-5 text-center text-neutral-0">
        <p className="text-3xl font-bold">Pas sur ce départ</p>
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
      <p className="text-3xl font-bold">Déjà embarqué</p>
      <p className="mt-1 text-lg">{outcome.name}</p>
      <p className="text-sm opacity-90">Vérifiez qu’il ne s’agit pas d’une seconde personne.</p>
    </div>
  )
}
