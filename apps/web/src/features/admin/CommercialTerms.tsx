import { useEffect, useState } from 'react'
import { formatMoney } from '@motoboy/shared'
import { describeError } from '../../lib/errors'
import { Button, ErrorNote, Field, INPUT } from '../../shared/ui'
import { useUpdateTerms } from './useAdmin'

export type Terms = {
  commission_type?: string
  commission_value?: number
  fee_bearer?: string
  payout_delay_hours?: number
  payout_frequency?: string
  payout_day?: number
  payout_minimum_amount?: number
  counter_sale_commission_enabled?: boolean
  counter_sale_sms_enabled?: boolean
  cancellation_deadline_hours?: number
  cancellation_fee_type?: string
  cancellation_fee_value?: number
  hold_duration_minutes?: number
  online_sales_cutoff_minutes?: number
}

/** Les jours ISO, tels que `BuildDuePayouts` les compare. */
const WEEKDAYS = [
  [1, 'Lundi'],
  [2, 'Mardi'],
  [3, 'Mercredi'],
  [4, 'Jeudi'],
  [5, 'Vendredi'],
  [6, 'Samedi'],
  [7, 'Dimanche'],
] as const

/**
 * Les conditions commerciales d'une agence.
 *
 * **Quatorze champs, et trois d'entre eux changent de sens selon un autre.** Une
 * grille de saisie uniforme les rendrait faux sans jamais le dire :
 *
 * - `commission_value` vaut des points de base quand le type est `PERCENTAGE`, et
 *   des francs quand il est `FIXED`. Le plafond de 10 000 se lit alors « 100 % »
 *   ou « 10 000 F », deux choses sans rapport.
 * - `cancellation_fee_value` fonctionne pareil, plafonné à 5 000 — soit 50 %,
 *   parce qu'une agence ne peut pas rendre une réservation intégralement non
 *   remboursable à l'intérieur de sa propre fenêtre d'annulation.
 * - `payout_day` est un **jour du mois** en mensuel et un **jour de la semaine**
 *   en hebdomadaire. La validation accepte 1 à 28 dans les deux cas : saisir 15
 *   en hebdomadaire passe la validation puis se fait ramener à dimanche par
 *   `BuildDuePayouts`, sans que rien ne le signale. D'où deux contrôles distincts
 *   plutôt qu'un champ numérique.
 *
 * **Seuls les champs modifiés partent.** Toutes les règles de l'API sont en
 * `sometimes` : renvoyer l'objet entier écraserait ce qu'un autre administrateur
 * vient de changer entre le chargement de la page et l'enregistrement.
 */
export function CommercialTerms({
  reference,
  terms,
}: {
  reference: string
  terms: Terms | null | undefined
}) {
  const update = useUpdateTerms(reference)
  const [draft, setDraft] = useState<Terms>({})

  // Se recale sur le serveur à chaque rechargement de la fiche : sans cela, un
  // brouillon survivrait à l'enregistrement et donnerait à croire à des
  // modifications en attente qui n'existent plus.
  useEffect(() => setDraft(terms ?? {}), [terms])

  const set = <K extends keyof Terms>(key: K, value: Terms[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const changed = (Object.keys(draft) as (keyof Terms)[]).filter(
    (key) => draft[key] !== (terms ?? {})[key],
  )

  const number = (key: keyof Terms, raw: string) => {
    const parsed = Number.parseInt(raw, 10)
    set(key, (Number.isInteger(parsed) ? parsed : undefined) as Terms[typeof key])
  }

  const percentage = draft.commission_type !== 'FIXED'
  const cancellationPercentage = draft.cancellation_fee_type !== 'FIXED'
  const weekly = draft.payout_frequency !== 'MONTHLY'

  return (
    <section className="border-t border-neutral-200 pt-4">
      <h3 className="mb-1 text-sm font-bold text-ink-700">Conditions commerciales</h3>
      <p className="mb-3 text-xs text-neutral-500">
        Sans réglage, l’agence est admise aux conditions par défaut de la plateforme.
      </p>

      {update.error ? <ErrorNote message={describeError(update.error)} /> : null}

      <div className="flex flex-col gap-4">
        <Group title="Commission">
          <Field label="Mode de calcul">
            <select
              className={INPUT}
              value={draft.commission_type ?? 'PERCENTAGE'}
              onChange={(event) => set('commission_type', event.target.value)}
            >
              <option value="PERCENTAGE">Pourcentage du billet</option>
              <option value="FIXED">Montant fixe par billet</option>
            </select>
          </Field>

          <Field
            label={
              percentage
                ? 'Commission, en points de base'
                : 'Commission, montant en francs'
            }
            hint={
              percentage
                ? `${((draft.commission_value ?? 0) / 100).toFixed(2)} % — maximum 100 %`
                : `${formatMoney({ amount: draft.commission_value ?? 0, currency: 'XAF' }, 'fr')} — maximum 10 000 F`
            }
          >
            <input
              className={INPUT}
              inputMode="numeric"
              value={draft.commission_value ?? ''}
              onChange={(event) => number('commission_value', event.target.value)}
            />
          </Field>

          {/*
            Le passager n'apparaît pas dans cette liste, et ce n'est pas un oubli :
            lui faire porter les frais d'agrégateur ferait diverger le prix affiché
            du prix guichet, ce qui ôte sa raison d'être à un comparateur.
          */}
          <Field label="Qui porte les frais d’agrégateur">
            <select
              className={INPUT}
              value={draft.fee_bearer ?? 'PLATFORM'}
              onChange={(event) => set('fee_bearer', event.target.value)}
            >
              <option value="PLATFORM">La plateforme</option>
              <option value="AGENCY">L’agence</option>
            </select>
          </Field>
        </Group>

        <Group title="Reversements">
          <Field
            label="Délai après le départ, en heures"
            hint="Jamais avant le départ : un remboursement arrivé après un virement Mobile Money ne se récupère pas."
          >
            <input
              className={INPUT}
              inputMode="numeric"
              value={draft.payout_delay_hours ?? ''}
              onChange={(event) => number('payout_delay_hours', event.target.value)}
            />
          </Field>

          <Field label="Fréquence">
            <select
              className={INPUT}
              value={draft.payout_frequency ?? 'WEEKLY'}
              onChange={(event) => set('payout_frequency', event.target.value)}
            >
              <option value="WEEKLY">Hebdomadaire</option>
              <option value="MONTHLY">Mensuelle</option>
            </select>
          </Field>

          {weekly ? (
            <Field label="Jour de la semaine">
              <select
                className={INPUT}
                value={draft.payout_day ?? 1}
                onChange={(event) => number('payout_day', event.target.value)}
              >
                {WEEKDAYS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field
              label="Jour du mois"
              hint="De 1 à 28 — les mois courts n’ont pas de 30."
            >
              <input
                className={INPUT}
                inputMode="numeric"
                value={draft.payout_day ?? ''}
                onChange={(event) => number('payout_day', event.target.value)}
              />
            </Field>
          )}

          <Field
            label="Montant minimum en francs"
            hint="En dessous, le reversement attend la période suivante plutôt que de coûter des frais pour presque rien."
          >
            <input
              className={INPUT}
              inputMode="numeric"
              value={draft.payout_minimum_amount ?? ''}
              onChange={(event) => number('payout_minimum_amount', event.target.value)}
            />
          </Field>
        </Group>

        <Group title="Vente au comptoir">
          <Toggle
            label="Prélever la commission sur les ventes au guichet"
            checked={draft.counter_sale_commission_enabled ?? false}
            onChange={(value) => set('counter_sale_commission_enabled', value)}
          />
          <Toggle
            label="Envoyer le SMS de confirmation au passager"
            checked={draft.counter_sale_sms_enabled ?? false}
            onChange={(value) => set('counter_sale_sms_enabled', value)}
          />
        </Group>

        <Group title="Annulation">
          <Field label="Délai d’annulation avant le départ, en heures">
            <input
              className={INPUT}
              inputMode="numeric"
              value={draft.cancellation_deadline_hours ?? ''}
              onChange={(event) =>
                number('cancellation_deadline_hours', event.target.value)
              }
            />
          </Field>

          <Field label="Mode de calcul des frais">
            <select
              className={INPUT}
              value={draft.cancellation_fee_type ?? 'PERCENTAGE'}
              onChange={(event) => set('cancellation_fee_type', event.target.value)}
            >
              <option value="PERCENTAGE">Pourcentage du montant payé</option>
              <option value="FIXED">Montant fixe</option>
            </select>
          </Field>

          {/*
            Nommé « frais d'annulation » et non « valeur » : deux champs portant le
            même libellé sur un même écran s'annoncent identiquement à un lecteur
            d'écran, et se confondent aussi à l'œil.
          */}
          <Field
            label={
              cancellationPercentage
                ? 'Frais d’annulation, en points de base'
                : 'Frais d’annulation, montant en francs'
            }
            hint={
              cancellationPercentage
                ? `${((draft.cancellation_fee_value ?? 0) / 100).toFixed(2)} % — plafonné à 50 %, une réservation ne peut pas être intégralement non remboursable`
                : `${formatMoney({ amount: draft.cancellation_fee_value ?? 0, currency: 'XAF' }, 'fr')} — maximum 5 000 F`
            }
          >
            <input
              className={INPUT}
              inputMode="numeric"
              value={draft.cancellation_fee_value ?? ''}
              onChange={(event) => number('cancellation_fee_value', event.target.value)}
            />
          </Field>
        </Group>

        <Group title="Réservation">
          <Field
            label="Durée de tenue des places, en minutes"
            hint="De 5 à 30. C’est le temps laissé pour payer avant que les places repartent à la vente."
          >
            <input
              className={INPUT}
              inputMode="numeric"
              value={draft.hold_duration_minutes ?? ''}
              onChange={(event) => number('hold_duration_minutes', event.target.value)}
            />
          </Field>

          <Field
            label="Clôture des ventes en ligne, en minutes avant le départ"
            hint="Laisse à l’agence le temps de préparer l’embarquement sans réservation de dernière seconde."
          >
            <input
              className={INPUT}
              inputMode="numeric"
              value={draft.online_sales_cutoff_minutes ?? ''}
              onChange={(event) =>
                number('online_sales_cutoff_minutes', event.target.value)
              }
            />
          </Field>
        </Group>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          label="Enregistrer les conditions"
          disabled={changed.length === 0 || update.isPending}
          onPress={() =>
            update.mutate(
              Object.fromEntries(changed.map((key) => [key, draft[key]])) as Record<
                string,
                unknown
              >,
            )
          }
        />
        <span className="text-xs text-neutral-500">
          {changed.length === 0
            ? 'Aucune modification.'
            : `${changed.length} champ${changed.length > 1 ? 's' : ''} modifié${changed.length > 1 ? 's' : ''} — seuls ceux-là seront transmis.`}
        </span>
      </div>
    </section>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-neutral-200 p-3">
      <legend className="px-1 text-xs font-bold text-neutral-700">{title}</legend>
      <div className="flex flex-col gap-2">{children}</div>
    </fieldset>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}
