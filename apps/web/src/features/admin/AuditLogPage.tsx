import { useState } from 'react'
import { describeError } from '../../lib/errors'
import {
  Button,
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  Skeleton,
  Table,
} from '../../shared/ui'
import { useAuditLogs } from './useAdmin'

type Entry = {
  id?: number
  action?: string
  auditable_type?: string | null
  auditable_id?: number | null
  user_id?: number | null
  old_values?: Record<string, unknown> | null
  new_values?: Record<string, unknown> | null
  ip_address?: string | null
  created_at?: string | null
}

/**
 * Le journal d'audit.
 *
 * **Il était écrit et jamais lu.** Chaque décision d'administration s'y
 * enregistrait déjà — admission d'agence, changement de commission, modération
 * d'une gare — sans qu'aucun écran ne les affiche. Un journal que personne ne
 * peut ouvrir ne protège de rien : il coûte de l'écriture et ne rend aucun
 * service le jour où l'on cherche qui a changé quoi.
 *
 * L'avant et l'après sont montrés côte à côte, parce que c'est l'écart qui
 * renseigne. « Commission modifiée » ne dit rien ; « 250 → 900 » dit tout.
 */
export function AuditLogPage() {
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const logs = useAuditLogs(action, page)

  const body = logs.data as { data?: Entry[]; meta?: { last_page?: number } } | undefined
  const rows = body?.data ?? []
  const lastPage = body?.meta?.last_page ?? 1

  return (
    <div>
      <PageHeader
        title="Journal d’audit"
        subtitle="Qui a décidé quoi, et ce que valait la donnée avant."
      />

      <div className="mb-4 w-72">
        <Field label="Filtrer par action" hint="Laisser vide pour tout voir.">
          <input
            className={INPUT}
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              // Revenir à la première page : rester en page 4 d'un filtre qui
              // n'en compte qu'une donnerait une liste vide sans rien expliquer.
              setPage(1)
            }}
          />
        </Field>
      </div>

      {logs.isPending ? <Skeleton rows={5} /> : null}
      {logs.error ? <ErrorNote message={describeError(logs.error)} /> : null}

      {logs.isSuccess && rows.length === 0 ? (
        <EmptyState
          title="Aucune entrée"
          body={action === '' ? undefined : 'Aucune action ne porte ce nom.'}
        />
      ) : null}

      {rows.length > 0 ? (
        <Table head={['Quand', 'Action', 'Objet', 'Changement']}>
          {rows.map((entry, index) => (
            <tr key={entry.id ?? index} className="border-t border-neutral-200 align-top">
              <Cell className="whitespace-nowrap text-xs text-neutral-500">
                {entry.created_at ?? '—'}
                {entry.ip_address ? (
                  <span className="block">{entry.ip_address}</span>
                ) : null}
              </Cell>
              <Cell>
                <span className="font-bold text-ink-700">{entry.action ?? '—'}</span>
                {entry.user_id === null || entry.user_id === undefined ? null : (
                  <span className="block text-xs text-neutral-500">
                    par le compte {entry.user_id}
                  </span>
                )}
              </Cell>
              <Cell className="text-xs">
                {entry.auditable_type ?? '—'}
                {entry.auditable_id === null || entry.auditable_id === undefined
                  ? ''
                  : ` #${entry.auditable_id}`}
              </Cell>
              <Cell>
                <Change before={entry.old_values} after={entry.new_values} />
              </Cell>
            </tr>
          ))}
        </Table>
      ) : null}

      {lastPage > 1 ? (
        <div className="mt-4 flex items-center gap-3">
          <Button
            label="Précédente"
            variant="secondary"
            disabled={page <= 1}
            onPress={() => setPage((current) => current - 1)}
          />
          <span className="text-sm text-neutral-500">
            Page {page} sur {lastPage}
          </span>
          <Button
            label="Suivante"
            variant="secondary"
            disabled={page >= lastPage}
            onPress={() => setPage((current) => current + 1)}
          />
        </div>
      ) : null}
    </div>
  )
}

/**
 * L'écart entre l'avant et l'après.
 *
 * Seuls les champs qui ont bougé sont montrés. Recopier l'objet entier noierait
 * la modification au milieu de dix valeurs identiques — et c'est la modification
 * qu'on est venu chercher.
 */
function Change({
  before,
  after,
}: {
  before?: Record<string, unknown> | null | undefined
  after?: Record<string, unknown> | null | undefined
}) {
  const keys = [
    ...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]),
  ].filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))

  if (keys.length === 0) {
    return <span className="text-xs text-neutral-500">—</span>
  }

  return (
    <ul className="flex flex-col gap-0.5 text-xs">
      {keys.map((key) => (
        <li key={key}>
          <span className="text-neutral-500">{key} : </span>
          <span className="text-neutral-700">{render(before?.[key])}</span>
          <span className="text-neutral-500"> → </span>
          <span className="font-bold text-ink-700">{render(after?.[key])}</span>
        </li>
      ))}
    </ul>
  )
}

function render(value: unknown): string {
  if (value === null || value === undefined) return '∅'
  if (typeof value === 'object') return JSON.stringify(value)

  return String(value)
}
