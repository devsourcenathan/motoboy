import { useState } from 'react'
import { describeError } from '../../lib/errors'
import { Badge } from '../../shared/ui'
import {
  usePayoutAccounts,
  useVerifyPayoutAccount,
  type AdminPayoutAccountRow,
} from './usePayoutAccounts'

/**
 * Les destinations de virement à vérifier (B4, C9).
 *
 * **Ce geste manquait, et personne ne pouvait être payé.** Un chauffeur déclare
 * son compte Mobile Money, il reste inactif jusqu'à vérification, et la passe de
 * reversement s'arrête sur `NO_VERIFIED_ACCOUNT` — sans qu'aucune erreur ne
 * remonte, ni à lui ni à l'administration.
 *
 * Le contrôle consiste à **comparer trois choses** : le nom du bénéficiaire, le
 * nom porté par le compte Mobile Money, et le numéro. C'est pourquoi la ligne les
 * montre côte à côte plutôt que de se contenter d'un identifiant.
 */
export function PayoutAccountsPage() {
  const accounts = usePayoutAccounts()

  const rows = accounts.data?.data ?? []
  const pending = rows.filter((row) => !row.verified)

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink-700">Comptes de versement</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Une erreur de saisie envoie l’argent à un inconnu, sans recours. Vérifiez que le
          nom du compte correspond au bénéficiaire.
        </p>
      </header>

      {accounts.isPending ? (
        <p className="text-sm text-neutral-500">Chargement…</p>
      ) : null}

      {accounts.error ? (
        <p className="text-sm whitespace-pre-line text-danger">
          {describeError(accounts.error)}
        </p>
      ) : null}

      {accounts.data && pending.length === 0 ? (
        <p className="mb-6 rounded-lg bg-success-50 p-4 text-sm text-success-700">
          Aucun compte n’attend de vérification.
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((row) => (
          <AccountRow key={row.id} row={row} />
        ))}
      </ul>
    </div>
  )
}

function AccountRow({ row }: { row: AdminPayoutAccountRow }) {
  const verify = useVerifyPayoutAccount()
  const [confirming, setConfirming] = useState(false)

  /*
   * Le nom déclaré et celui du bénéficiaire, rapprochés à l'œil. La comparaison
   * n'est pas automatisée : « Jean Kamdem » et « KAMDEM Jean N. » sont le même
   * homme, et une égalité de chaînes refuserait un compte parfaitement valide.
   */
  return (
    <li className="rounded-xl bg-neutral-0 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-neutral-900">{row.owner ?? '—'}</p>
          <p className="text-sm text-neutral-500">
            {row.kind === 'DRIVER' ? 'Chauffeur' : 'Agence'}
            {row.owner_phone === null ? '' : ` · ${row.owner_phone}`}
          </p>
        </div>

        <Badge
          label={row.verified ? 'Vérifié' : 'À vérifier'}
          tone={row.verified ? 'good' : 'action'}
        />
      </div>

      <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between border-b border-neutral-100 pb-1">
          <dt className="text-neutral-500">Nom sur le compte</dt>
          <dd className="font-medium">{row.account_name ?? '—'}</dd>
        </div>
        <div className="flex justify-between border-b border-neutral-100 pb-1">
          <dt className="text-neutral-500">Numéro</dt>
          <dd className="font-mono">{row.masked_number}</dd>
        </div>
        <div className="flex justify-between border-b border-neutral-100 pb-1">
          <dt className="text-neutral-500">Opérateur</dt>
          <dd className="font-medium">{row.operator ?? row.type}</dd>
        </div>
        <div className="flex justify-between border-b border-neutral-100 pb-1">
          <dt className="text-neutral-500">Déclaré le</dt>
          <dd>
            {row.submitted_at === null
              ? '—'
              : new Date(row.submitted_at).toLocaleDateString('fr')}
          </dd>
        </div>
      </dl>

      {row.verified ? null : (
        <div className="mt-5">
          {confirming ? (
            <div className="rounded-lg bg-neutral-50 p-4">
              {/*
                Une confirmation, parce que la vérification n'a pas de contraire :
                elle ouvre la porte à des virements réels et ne se retire pas.
              */}
              <p className="text-sm text-neutral-700">
                Confirmez que <strong>{row.account_name}</strong> est bien le compte de{' '}
                <strong>{row.owner}</strong>. Les virements partiront là.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate(row.id, { onSuccess: () => setConfirming(false) })
                  }
                  className="rounded-lg bg-success-500 px-4 py-2 text-sm font-semibold text-neutral-0 hover:bg-success-700 disabled:opacity-50"
                >
                  Vérifier ce compte
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-lg px-4 py-2 text-sm text-neutral-700"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-0 hover:bg-brand-600"
            >
              Vérifier
            </button>
          )}
        </div>
      )}

      {verify.error ? (
        <p className="mt-3 text-sm whitespace-pre-line text-danger">
          {describeError(verify.error)}
        </p>
      ) : null}
    </li>
  )
}
