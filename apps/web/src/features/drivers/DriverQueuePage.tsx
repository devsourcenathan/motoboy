import { useState } from 'react'
import type { DriverDocumentType, DriverStatus } from '@motoboy/api-client/types'
import { describeError } from '../../lib/errors'
import {
  Actions,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  SkeletonText,
} from '../../shared/ui'
import { useDecideDriver, useDriverQueue, type AdminDriverRow } from './useDrivers'

/**
 * Les quatre pièces exigées d'un chauffeur.
 *
 * Écrites ici pour pouvoir dire **ce qui manque**, et non seulement ce qui est
 * déposé : une liste de trois pièces ne se lit pas comme un dossier incomplet
 * tant qu'on ne sait pas qu'il en faut quatre.
 */
const REQUIRED: readonly DriverDocumentType[] = [
  'LICENSE',
  'REGISTRATION',
  'IDENTITY',
  'INSURANCE',
]

const DOCUMENT_LABELS: Record<DriverDocumentType, string> = {
  LICENSE: 'Permis',
  REGISTRATION: 'Carte grise',
  IDENTITY: 'Identité',
  INSURANCE: 'Assurance',
}

const TABS: readonly { status: DriverStatus; label: string }[] = [
  { status: 'PENDING', label: 'À instruire' },
  { status: 'APPROVED', label: 'Validés' },
  { status: 'REJECTED', label: 'Refusés' },
  { status: 'SUSPENDED', label: 'Suspendus' },
]

/**
 * La file des dossiers de chauffeur (A1–A3).
 *
 * **Sans agence pour répondre d'un incident, cette file est la seule barrière**
 * entre la plateforme et un chauffeur dont personne n'a vu le permis. Elle est
 * donc la première page du back-office, et non un onglet secondaire.
 *
 * Du plus ancien au plus récent, comme le sert l'API : celui qui attend depuis
 * le plus longtemps est celui à qui il faut répondre.
 */
export function DriverQueuePage() {
  const [status, setStatus] = useState<DriverStatus>('PENDING')
  const queue = useDriverQueue(status)

  return (
    <div>
      <PageHeader
        title="Dossiers de chauffeur"
        subtitle="Personne d’autre ne vérifie ces pièces. Un dossier validé met quelqu’un au volant avec des passagers."
      />

      <nav className="mb-4 flex gap-1 border-b border-neutral-300">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            onClick={() => setStatus(tab.status)}
            className={
              tab.status === status
                ? 'border-b-2 border-brand-500 px-4 py-2 text-sm font-semibold text-brand-600'
                : 'px-4 py-2 text-sm text-neutral-500 hover:text-neutral-900'
            }
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/*
        **Un squelette à la forme des fiches, pas le mot « Chargement… ».**
        Cet écran n'utilisait aucune primitive partagée : son attente était une
        phrase, son erreur un paragraphe nu, son vide un encadré à lui. Trois
        façons de dire ce que le reste du produit dit d'une seule.
      */}
      {queue.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((index) => (
            <Card key={index}>
              <SkeletonText lines={3} />
            </Card>
          ))}
        </div>
      ) : null}

      {queue.error ? <ErrorNote message={describeError(queue.error)} /> : null}

      {queue.data?.data.length === 0 ? (
        <EmptyState
          title={
            status === 'PENDING'
              ? 'Aucun dossier n’attend de décision'
              : 'Aucun dossier dans cet état'
          }
          body={
            status === 'PENDING'
              ? 'Les candidatures arrivent depuis l’application : un chauffeur indépendant dépose son permis, sa carte grise et son assurance.'
              : undefined
          }
        />
      ) : null}

      <ul className="flex flex-col gap-3">
        {queue.data?.data.map((row) => (
          <DriverCard key={row.id} row={row} />
        ))}
      </ul>
    </div>
  )
}

function DriverCard({ row }: { row: AdminDriverRow }) {
  const decide = useDecideDriver()
  const [reason, setReason] = useState('')
  const [asking, setAsking] = useState<'reject' | 'suspend' | null>(null)

  const filed = new Map(row.documents.map((doc) => [doc.type, doc]))
  const missing = REQUIRED.filter((type) => !filed.has(type))
  const complete = missing.length === 0

  return (
    <li className="rounded-xl bg-neutral-0 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-neutral-900">
            {[row.driver.first_name, row.driver.last_name].filter(Boolean).join(' ') ||
              '—'}
          </p>
          <p className="text-sm text-neutral-500">
            {row.driver.phone ?? '—'} · {row.vehicle_plate ?? 'sans plaque'}
          </p>
          {row.submitted_at === null ? null : (
            <p className="mt-1 text-xs text-neutral-500">
              Déposé le {new Date(row.submitted_at).toLocaleDateString('fr')}
            </p>
          )}
        </div>

        <Badge label={row.status} tone={row.status === 'APPROVED' ? 'good' : 'neutral'} />
      </div>

      {/*
        Ce qui manque, nommé. Lister les pièces déposées laisserait l'instructeur
        faire lui-même la soustraction, à chaque dossier.

        **Et ce qui est là s'ouvre.** Ces pastilles ne disaient que la présence,
        parce que l'API ne rendait que des types : on approuvait un chauffeur
        sans avoir pu regarder son permis. Une pièce déposée est désormais un
        lien — nouvel onglet, le lien étant signé et valable dix minutes, et la
        décision se prend en gardant la file ouverte.
      */}
      <div className="mt-4 flex flex-wrap gap-2">
        {REQUIRED.map((type) => {
          const doc = filed.get(type)

          if (doc === undefined) {
            return (
              <span
                key={type}
                className="rounded-md bg-danger-soft px-2 py-1 text-xs text-danger-strong"
              >
                ✗ {DOCUMENT_LABELS[type]}
              </span>
            )
          }

          return (
            <a
              key={type}
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-success-50 px-2 py-1 text-xs text-success-700 underline decoration-success-700/40 underline-offset-2 hover:decoration-success-700"
            >
              ✓ {DOCUMENT_LABELS[type]}
            </a>
          )
        })}
      </div>

      {row.status === 'PENDING' ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            label="Valider"
            icon="check"
            disabled={!complete}
            loading={decide.isPending}
            onPress={() => decide.mutate({ id: row.id, decision: 'approve' })}
          />
          <Button
            label="Refuser"
            variant="secondary"
            disabled={decide.isPending}
            onPress={() => setAsking('reject')}
          />

          {/*
            Le bouton reste inerte tant qu'il manque une pièce, et le dit. Rien
            n'empêche de refuser un dossier incomplet — c'est valider qui doit
            être impossible.
          */}
          {complete ? null : (
            <span className="text-xs text-neutral-500">
              Validation impossible : {missing.map((t) => DOCUMENT_LABELS[t]).join(', ')}{' '}
              manquant
              {missing.length > 1 ? 's' : ''}.
            </span>
          )}
        </div>
      ) : null}

      {row.status === 'APPROVED' ? (
        <div className="mt-5">
          <Button
            label="Suspendre"
            variant="danger"
            disabled={decide.isPending}
            onPress={() => setAsking('suspend')}
          />
        </div>
      ) : null}

      {asking === null ? null : (
        <form
          className="mt-4 rounded-lg bg-neutral-50 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            decide.mutate(
              { id: row.id, decision: asking, reason: reason.trim() },
              { onSuccess: () => setAsking(null) },
            )
          }}
        >
          <Field label="Motif — il sera lu par le chauffeur">
            <textarea
              required
              maxLength={500}
              rows={2}
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={INPUT}
              placeholder="Permis illisible, plaque ne correspondant pas à la carte grise…"
            />
          </Field>

          <div className="mt-3">
            <Actions>
              <Button label="Annuler" variant="ghost" onPress={() => setAsking(null)} />
              <Button
                label={
                  asking === 'reject' ? 'Refuser le dossier' : 'Suspendre le chauffeur'
                }
                variant="danger"
                type="submit"
                loading={decide.isPending}
              />
            </Actions>
          </div>
        </form>
      )}

      {decide.error ? (
        <div className="mt-3">
          <ErrorNote message={describeError(decide.error)} />
        </div>
      ) : null}
    </li>
  )
}
