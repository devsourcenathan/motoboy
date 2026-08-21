import { useState } from 'react'
import { formatMoney } from '@motoboy/shared'
import { describeError } from '../../lib/errors'
import { CommercialTerms, type Terms } from './CommercialTerms'
import {
  Button,
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  SkeletonText,
  SkeletonTable,
  Sheet,
  Table,
} from '../../shared/ui'
import {
  useAdjustLedger,
  useAgencies,
  useAgency,
  useDecideAgency,
  type AgencyStatus,
} from './useAdmin'

const TABS: readonly { status: AgencyStatus; label: string }[] = [
  { status: 'PENDING', label: 'À instruire' },
  { status: 'APPROVED', label: 'Admises' },
  { status: 'REJECTED', label: 'Refusées' },
  { status: 'SUSPENDED', label: 'Suspendues' },
]

type Row = {
  reference: string
  name: string
  legal_name?: string | null
  phone?: string | null
  email?: string | null
  status: string
  documents_count?: number
  has_verified_payout_account?: boolean
}

/**
 * L'admission des agences.
 *
 * **C'est la porte d'entrée de la plateforme, et elle n'existait pas.** Six
 * routes d'API la desservaient sans qu'aucun écran ne les appelle : une agence
 * pouvait déposer son dossier et personne, nulle part, ne pouvait y répondre.
 *
 * Ce qu'une admission engage mérite d'être dit sur la page elle-même. Une agence
 * admise vend des places, encaisse de l'argent qui transite par la plateforme, et
 * met des passagers dans des véhicules. La liste montre donc **ce qui manque**
 * avant de proposer d'admettre : le nombre de pièces déposées et l'existence
 * d'un compte de reversement vérifié.
 */
export function AgenciesPage() {
  const [status, setStatus] = useState<AgencyStatus>('PENDING')
  const [open, setOpen] = useState<string | null>(null)
  const queue = useAgencies(status)

  const rows = ((queue.data as { data?: Row[] } | undefined)?.data ?? []) as Row[]

  return (
    <div>
      <PageHeader
        title="Agences"
        subtitle="Une agence admise vend des places et encaisse de l’argent. Personne d’autre ne relit son dossier."
      />

      <nav className="mb-4 flex gap-1 border-b border-neutral-300">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            onClick={() => setStatus(tab.status)}
            className={
              tab.status === status
                ? 'border-b-2 border-orange-500 px-4 py-2 text-sm font-bold text-ink-700'
                : 'px-4 py-2 text-sm text-neutral-500'
            }
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {queue.isPending ? <SkeletonTable columns={4} rows={4} /> : null}
      {queue.error ? <ErrorNote message={describeError(queue.error)} /> : null}

      {queue.isSuccess && rows.length === 0 ? (
        <EmptyState
          title="Aucune agence dans cette file"
          body="Les dossiers déposés apparaissent ici, du plus ancien au plus récent."
        />
      ) : null}

      {rows.length > 0 ? (
        <Table head={['Agence', 'Contact', 'Dossier', '']}>
          {rows.map((row) => (
            <tr key={row.reference} className="border-t border-neutral-200">
              <Cell>
                <span className="font-bold text-ink-700">{row.name}</span>
                {row.legal_name ? (
                  <span className="block text-xs text-neutral-500">{row.legal_name}</span>
                ) : null}
              </Cell>
              <Cell>
                {row.phone ?? '—'}
                {row.email ? (
                  <span className="block text-xs text-neutral-500">{row.email}</span>
                ) : null}
              </Cell>
              <Cell>
                {row.documents_count ?? 0} pièce
                {(row.documents_count ?? 0) > 1 ? 's' : ''}
                {/*
                  Un compte de reversement non vérifié n'empêche pas l'admission,
                  mais il empêche de payer l'agence. Le dire ici évite d'admettre
                  quelqu'un qu'on ne pourra pas régler.
                */}
                <span
                  className={
                    row.has_verified_payout_account === true
                      ? 'block text-xs text-green-700'
                      : 'block text-xs text-neutral-500'
                  }
                >
                  {row.has_verified_payout_account === true
                    ? 'Compte de reversement vérifié'
                    : 'Aucun compte de reversement vérifié'}
                </span>
              </Cell>
              <Cell>
                <Button
                  variant="secondary"
                  onPress={() => setOpen(row.reference)}
                  label="Ouvrir le dossier"
                />
              </Cell>
            </tr>
          ))}
        </Table>
      ) : null}

      {open === null ? null : (
        <AgencyPanel reference={open} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}

/**
 * Le dossier, et les trois gestes qu'il autorise.
 *
 * Tout est dans un même panneau — pièces, conditions commerciales, écritures —
 * parce que ces trois choses se décident ensemble : on ne fixe pas une commission
 * sans avoir vu qui on admet.
 */
function AgencyPanel({ reference, onClose }: { reference: string; onClose: () => void }) {
  const detail = useAgency(reference)
  const decide = useDecideAgency()
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const agency = detail.data as
    | {
        name?: string
        status?: string
        documents?: {
          id: number
          type: string
          status: string
          expires_at?: string | null
          url?: string
        }[]
        commercial_terms?: Terms | null
      }
    | undefined

  return (
    <Sheet title={agency?.name ?? 'Dossier'} onClose={onClose}>
      {detail.isPending ? <SkeletonText lines={5} /> : null}
      {detail.error ? <ErrorNote message={describeError(detail.error)} /> : null}

      {agency === undefined ? null : (
        <div className="flex flex-col gap-6">
          <section>
            <h3 className="mb-2 text-sm font-bold text-ink-700">Pièces déposées</h3>
            {(agency.documents ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">
                Aucune pièce. Admettre une agence dont personne n’a vu le registre de
                commerce revient à ne pas l’avoir instruite.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {/*
                  **Le type devient un lien.** Cette liste énumérait des pièces
                  que rien ne permettait d'ouvrir : le message ci-dessus disait
                  déjà qu'admettre sans avoir vu le registre revient à ne pas
                  instruire, et c'était vrai même une fois la pièce déposée.
                  Nouvel onglet — le lien est signé, valable dix minutes, et le
                  dossier reste ouvert derrière.
                */}
                {(agency.documents ?? []).map((doc) => (
                  <li key={doc.id} className="flex justify-between gap-4">
                    {doc.url === undefined ? (
                      <span>{doc.type}</span>
                    ) : (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        {doc.type}
                      </a>
                    )}
                    <span className="text-neutral-500">
                      {doc.status}
                      {doc.expires_at ? ` — expire le ${doc.expires_at}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {agency.status === 'PENDING' ? (
            <section className="border-t border-neutral-200 pt-4">
              {decide.error ? <ErrorNote message={describeError(decide.error)} /> : null}

              {rejecting ? (
                <div className="flex flex-col gap-2">
                  <Field label="Motif du refus">
                    <input
                      className={INPUT}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </Field>
                  {/*
                    Le motif part à l'agence : c'est ce qui lui dit quoi corriger
                    pour revenir. Un refus sans motif ferait redéposer le même
                    dossier.
                  */}
                  <p className="text-xs text-neutral-500">
                    Ce motif est communiqué à l’agence. Écrivez ce qu’elle doit corriger.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      disabled={reason.trim().length < 3 || decide.isPending}
                      onPress={() =>
                        decide.mutate(
                          { reference, decision: 'reject', reason: reason.trim() },
                          { onSuccess: onClose },
                        )
                      }
                      label="Confirmer le refus"
                    />
                    <Button
                      variant="secondary"
                      onPress={() => setRejecting(false)}
                      label="Revenir"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    disabled={decide.isPending}
                    onPress={() =>
                      decide.mutate(
                        { reference, decision: 'approve' },
                        { onSuccess: onClose },
                      )
                    }
                    label="Admettre l’agence"
                  />
                  <Button
                    variant="secondary"
                    onPress={() => setRejecting(true)}
                    label="Refuser"
                  />
                </div>
              )}
            </section>
          ) : null}

          <CommercialTerms reference={reference} terms={agency.commercial_terms} />

          <LedgerAdjustment reference={reference} />
        </div>
      )}
    </Sheet>
  )
}

/**
 * Une correction manuelle du grand livre.
 *
 * **Le montant est signé.** Un nombre positif crédite l'agence, un négatif la
 * débite, et l'API refuse zéro. La description est obligatoire parce que cette
 * écriture n'a aucune trace ailleurs : elle ne vient ni d'une vente, ni d'un
 * remboursement, seulement d'une décision humaine qu'il faudra pouvoir relire.
 */
function LedgerAdjustment({ reference }: { reference: string }) {
  const adjust = useAdjustLedger(reference)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const value = Number.parseInt(amount, 10)
  const valid = Number.isInteger(value) && value !== 0 && description.trim().length >= 3

  return (
    <section className="border-t border-neutral-200 pt-4">
      <h3 className="mb-2 text-sm font-bold text-ink-700">Écriture manuelle</h3>

      {adjust.error ? <ErrorNote message={describeError(adjust.error)} /> : null}

      <Field label="Montant en francs (négatif pour débiter)">
        <input
          className={INPUT}
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </Field>

      {Number.isInteger(value) && value !== 0 ? (
        <p className="mt-1 text-xs text-neutral-500">
          {value > 0 ? 'Crédite' : 'Débite'} l’agence de{' '}
          {formatMoney({ amount: Math.abs(value), currency: 'XAF' }, 'fr')}.
        </p>
      ) : null}

      <div className="mt-2">
        <Field label="Motif">
          <input
            className={INPUT}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-3">
        <Button
          label="Écrire au grand livre"
          disabled={!valid || adjust.isPending}
          onPress={() =>
            adjust.mutate(
              { amount: value, description: description.trim() },
              {
                onSuccess: () => {
                  setAmount('')
                  setDescription('')
                },
              },
            )
          }
        />
      </div>
    </section>
  )
}
