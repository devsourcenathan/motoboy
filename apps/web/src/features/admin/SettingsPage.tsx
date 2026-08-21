import { useEffect, useState } from 'react'
import { describeError } from '../../lib/errors'
import {
  Button,
  Card,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  SkeletonText,
} from '../../shared/ui'
import {
  useSettings,
  useUpdateIdDocumentPolicy,
  useUpdateRideCommission,
} from './useAdmin'

type Settings = {
  ride_commission_bps?: number
  ride_commission_max_bps?: number
  id_document_mode?: string
  id_document_required?: boolean
}

/**
 * Les deux réglages de la plateforme.
 *
 * Ils n'ont rien en commun sinon d'être décidés au même niveau, et chacun agit
 * sur tout le monde à la fois : ce ne sont pas des préférences, ce sont des
 * règles. La page les sépare donc nettement et dit, pour chacun, sur quoi il
 * mord — sinon on modifie un pourcentage sans savoir qui le paiera.
 */
export function SettingsPage() {
  const settings = useSettings()
  const data = settings.data as Settings | undefined

  return (
    <div>
      <PageHeader
        title="Réglages"
        subtitle="Ces deux valeurs s’appliquent à toute la plateforme, immédiatement."
      />

      {/*
        Deux cartes de réglage, pas trois barres : la page rend des panneaux, et
        annoncer une liste fait tressauter l'écran au chargement.
      */}
      {settings.isPending ? (
        <div className="flex flex-col gap-6">
          {[0, 1].map((index) => (
            <Card key={index}>
              <SkeletonText lines={3} />
            </Card>
          ))}
        </div>
      ) : null}
      {settings.error ? <ErrorNote message={describeError(settings.error)} /> : null}

      {data === undefined ? null : (
        <div className="flex flex-col gap-6">
          <RideCommission
            current={data.ride_commission_bps ?? 0}
            max={data.ride_commission_max_bps ?? 3000}
          />
          <IdDocumentPolicy
            mode={data.id_document_mode ?? 'NUMBER'}
            required={data.id_document_required ?? false}
          />
        </div>
      )}
    </div>
  )
}

/**
 * La commission prélevée sur une course.
 *
 * **En points de base, et affichée en pourcentage.** La plateforme stocke des
 * entiers — 250 pour 2,5 % — parce qu'un pourcentage en virgule flottante finit
 * par perdre un franc quelque part. Mais personne ne raisonne en points de base,
 * donc l'écran montre les deux : on saisit ce qu'on comprend, on voit ce qui sera
 * enregistré.
 */
function RideCommission({ current, max }: { current: number; max: number }) {
  const update = useUpdateRideCommission()
  const [percent, setPercent] = useState('')

  // Se recale sur le serveur tant qu'on n'a rien tapé : sans cela, le champ
  // resterait vide après le chargement et donnerait à croire à une valeur nulle.
  useEffect(() => setPercent((current / 100).toString()), [current])

  const bps = Math.round(Number.parseFloat(percent.replace(',', '.')) * 100)
  const valid = Number.isInteger(bps) && bps >= 0 && bps <= max

  return (
    <Card>
      <h2 className="text-lg font-bold text-ink-700">Commission sur les courses</h2>
      <p className="mt-1 mb-4 text-sm text-neutral-500">
        Prélevée sur chaque course de moto. Elle ne concerne pas les billets d’agence,
        dont la commission se fixe agence par agence.
      </p>

      {update.error ? <ErrorNote message={describeError(update.error)} /> : null}

      <Field label="Pourcentage" hint={`Maximum autorisé : ${max / 100} %`}>
        <input
          className={INPUT}
          inputMode="decimal"
          value={percent}
          onChange={(event) => setPercent(event.target.value)}
        />
      </Field>

      <p className="mt-1 text-xs text-neutral-500">
        {valid
          ? `Enregistré comme ${bps} points de base.`
          : 'Valeur hors des bornes acceptées.'}
      </p>

      <div className="mt-3">
        <Button
          label="Enregistrer"
          disabled={!valid || bps === current || update.isPending}
          onPress={() => update.mutate({ commission_bps: bps })}
        />
      </div>
    </Card>
  )
}

/**
 * Ce qu'on exige d'un passager comme pièce d'identité.
 *
 * **Deux décisions distinctes, et c'est délibéré.** La première dit *sous quelle
 * forme* la pièce est recueillie — un numéro saisi, ou une photographie. La
 * seconde dit si elle est *obligatoire*. Les confondre empêcherait de recueillir
 * une image de façon facultative, qui est justement l'état de départ le plus
 * prudent : on collecte moins tant que la conservation n'est pas éprouvée.
 */
function IdDocumentPolicy({ mode, required }: { mode: string; required: boolean }) {
  const update = useUpdateIdDocumentPolicy()
  const [nextMode, setNextMode] = useState(mode)
  const [nextRequired, setNextRequired] = useState(required)

  useEffect(() => {
    setNextMode(mode)
    setNextRequired(required)
  }, [mode, required])

  const changed = nextMode !== mode || nextRequired !== required

  return (
    <Card>
      <h2 className="text-lg font-bold text-ink-700">Pièce d’identité des passagers</h2>

      {update.error ? <ErrorNote message={describeError(update.error)} /> : null}

      <div className="mt-3">
        <Field
          label="Forme recueillie"
          hint={
            nextMode === 'IMAGE'
              ? 'Une photographie est conservée. Plus lourd à stocker, et à protéger.'
              : 'Seul le numéro est saisi. Rien à conserver ni à sécuriser.'
          }
        >
          <select
            className={INPUT}
            value={nextMode}
            onChange={(event) => setNextMode(event.target.value)}
          >
            <option value="NUMBER">Numéro saisi</option>
            <option value="IMAGE">Photographie</option>
          </select>
        </Field>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={nextRequired}
          onChange={(event) => setNextRequired(event.target.checked)}
        />
        Obligatoire pour réserver
      </label>
      <p className="mt-1 text-xs text-neutral-500">
        {nextRequired
          ? 'Aucune réservation ne peut aboutir sans pièce.'
          : 'La pièce est demandée mais peut être laissée vide.'}
      </p>

      <div className="mt-3">
        <Button
          label="Enregistrer"
          disabled={!changed || update.isPending}
          onPress={() =>
            update.mutate({
              id_document_mode: nextMode,
              id_document_required: nextRequired,
            })
          }
        />
      </div>
    </Card>
  )
}
