import { useState } from 'react'
import type { DriverDocumentType, DriverStatus } from '@motoboy/api-client/types'
import { describeError } from '../../lib/errors'
import { Badge } from '../../shared/ui'
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
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink-700">Dossiers de chauffeur</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Personne d’autre ne vérifie ces pièces. Un dossier validé met quelqu’un au
          volant avec des passagers.
        </p>
      </header>

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

      {queue.isPending ? <p className="text-sm text-neutral-500">Chargement…</p> : null}

      {queue.error ? (
        <p className="text-sm whitespace-pre-line text-danger">
          {describeError(queue.error)}
        </p>
      ) : null}

      {queue.data?.data.length === 0 ? (
        <p className="rounded-lg bg-neutral-0 p-8 text-center text-sm text-neutral-500">
          {status === 'PENDING'
            ? 'Aucun dossier n’attend de décision.'
            : 'Aucun dossier.'}
        </p>
      ) : null}

      <ul className="space-y-3">
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
          <button
            type="button"
            disabled={!complete || decide.isPending}
            onClick={() => decide.mutate({ id: row.id, decision: 'approve' })}
            className="rounded-lg bg-success-500 px-4 py-2 text-sm font-semibold text-neutral-0 hover:bg-success-700 disabled:opacity-40"
          >
            Valider
          </button>
          <button
            type="button"
            disabled={decide.isPending}
            onClick={() => setAsking('reject')}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Refuser
          </button>

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
          <button
            type="button"
            disabled={decide.isPending}
            onClick={() => setAsking('suspend')}
            className="rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft"
          >
            Suspendre
          </button>
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
          <label
            className="block text-xs font-medium text-neutral-700"
            htmlFor={`r-${row.id}`}
          >
            Motif — il sera lu par le chauffeur
          </label>
          <textarea
            id={`r-${row.id}`}
            required
            maxLength={500}
            rows={2}
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Permis illisible, plaque ne correspondant pas à la carte grise…"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={decide.isPending}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-neutral-0 disabled:opacity-50"
            >
              {asking === 'reject' ? 'Refuser le dossier' : 'Suspendre le chauffeur'}
            </button>
            <button
              type="button"
              onClick={() => setAsking(null)}
              className="rounded-lg px-4 py-2 text-sm text-neutral-700"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {decide.error ? (
        <p className="mt-3 text-sm whitespace-pre-line text-danger">
          {describeError(decide.error)}
        </p>
      ) : null}
    </li>
  )
}
