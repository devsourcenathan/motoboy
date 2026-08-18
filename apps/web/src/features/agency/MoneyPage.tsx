import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { unwrap } from '@motoboy/api-client'
import { formatMoney } from '@motoboy/shared'
import { api } from '../../lib/api'
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
  Panel,
  Skeleton,
  Table,
} from '../../shared/ui'

/**
 * Le compte de l'agence.
 *
 * **Un compte courant, pas un décompte par période.** Chaque vente le crédite,
 * chaque commission et chaque remboursement le débitent, et un reversement le
 * solde. C'est ce qui permet d'absorber un remboursement arrivé après un
 * versement : la dette reste au compte et vient en déduction du suivant, au lieu
 * de devenir une créance à recouvrer.
 *
 * En **lecture seule** : l'agence constate, elle ne déclenche pas ses propres
 * virements. Le calcul est automatique, le décaissement reste humain et se décide
 * en administration.
 */
export function MoneyPage() {
  const ledger = useQuery({
    queryKey: ['agency', 'ledger'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/v1/agency/ledger', { signal })),
  })

  const payouts = useQuery({
    queryKey: ['agency', 'payouts'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/v1/agency/payouts', { signal })),
  })

  const accounts = useQuery({
    queryKey: ['agency', 'payout-accounts'],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/agency/payout-accounts', { signal })),
  })

  const [declaring, setDeclaring] = useState(false)

  const entries = ledger.data?.data ?? []
  const active = (accounts.data?.data ?? []).find((account) => account.verified)

  return (
    <div>
      <PageHeader
        title="Compte"
        subtitle="Vos écritures, vos reversements, et le compte sur lequel MOTOBOY vous verse."
        action={
          <Button
            label={active === undefined ? 'Déclarer un compte' : 'Changer de compte'}
            variant="secondary"
            onPress={() => setDeclaring(true)}
          />
        }
      />

      {/*
        La destination des virements en premier : c'est la seule chose de cette
        page sur laquelle l'agence peut agir, et son absence bloque tout
        reversement — silencieusement, du point de vue de qui attend son argent.
      */}
      <Card className="mb-6">
        <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
          Compte de versement
        </p>
        {accounts.isPending ? (
          <Skeleton rows={1} />
        ) : active === undefined ? (
          <p className="mt-1 text-sm text-danger">
            Aucun compte vérifié. Tant qu’il en manque un, aucun reversement ne peut partir.
          </p>
        ) : (
          <p className="mt-1 text-sm">
            <span className="font-medium">{active.account_name}</span> · {active.operator} ·{' '}
            <span className="font-mono">{active.masked_number}</span>
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold text-neutral-900">Reversements</h2>

          {payouts.isPending ? <Skeleton rows={3} /> : null}
          {payouts.error ? <ErrorNote message={describeError(payouts.error)} /> : null}

          {payouts.data !== undefined && (payouts.data.data ?? []).length === 0 ? (
            <EmptyState
              title="Aucun reversement"
              body="Ils apparaîtront ici dès qu’un solde sera exigible."
            />
          ) : (
            <Table head={['Référence', 'Net', 'État']}>
              {(payouts.data?.data ?? []).map((payout) => (
                <tr key={payout.reference}>
                  <Cell className="font-mono">{payout.reference}</Cell>
                  <Cell className="font-semibold">{formatMoney(payout.net, 'fr')}</Cell>
                  <Cell>{payout.status}</Cell>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-semibold text-neutral-900">Écritures récentes</h2>

          {ledger.isPending ? <Skeleton rows={3} /> : null}
          {ledger.error ? <ErrorNote message={describeError(ledger.error)} /> : null}

          {ledger.data !== undefined && entries.length === 0 ? (
            <EmptyState title="Aucune écriture" body="Votre première vente créditera ce compte." />
          ) : (
            <Table head={['Date', 'Libellé', 'Montant']}>
              {entries.map((entry, index) => (
                <tr key={`${entry.occurred_at}-${index}`}>
                  <Cell className="whitespace-nowrap">
                    {new Date(entry.occurred_at).toLocaleDateString('fr')}
                  </Cell>
                  <Cell>{entry.description ?? entry.type}</Cell>
                  {/*
                    Le signe est porté par la couleur autant que par le chiffre :
                    un relevé se parcourt du regard, et un « −800 » au milieu de
                    crédits se manque.
                  */}
                  <Cell
                    className={
                      entry.amount.amount < 0
                        ? 'text-right font-medium text-danger'
                        : 'text-right font-medium text-success-700'
                    }
                  >
                    {formatMoney(entry.amount, 'fr')}
                  </Cell>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>

      {declaring ? <AccountPanel onClose={() => setDeclaring(false)} /> : null}
    </div>
  )
}

function AccountPanel({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<'MOBILE_MONEY' | 'BANK'>('MOBILE_MONEY')
  const [operator, setOperator] = useState<'MTN' | 'ORANGE'>('MTN')
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [sent, setSent] = useState(false)

  return (
    <Panel title="Compte de versement" onClose={onClose}>
      {sent ? (
        <p className="rounded-lg bg-success-50 p-3 text-sm text-success-700">
          Déclaré. MOTOBOY vérifie ce compte avant qu’un virement puisse y partir ; le compte
          précédent reste actif jusque-là.
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)

            void api
              .POST('/v1/agency/payout-accounts', {
                body: {
                  type,
                  ...(type === 'MOBILE_MONEY' ? { operator } : {}),
                  account_number: number.trim(),
                  account_name: name.trim(),
                },
              })
              .then((response) => {
                if (response.error !== undefined) {
                  setError(response.error)

                  return
                }

                setSent(true)
              })
          }}
        >
          {/*
            Dit avant la saisie : une erreur de numéro envoie l'argent à un
            inconnu, sans recours. C'est pour cela que MOTOBOY vérifie, et
            l'expliquer évite qu'une agence s'inquiète du délai.
          */}
          <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
            Ce compte est vérifié par MOTOBOY avant d’être utilisé. Un virement mal dirigé ne se
            récupère pas.
          </p>

          <Field label="Type">
            <select
              className={INPUT}
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
            >
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="BANK">Compte bancaire</option>
            </select>
          </Field>

          {type === 'MOBILE_MONEY' ? (
            <Field label="Opérateur">
              <select
                className={INPUT}
                value={operator}
                onChange={(event) => setOperator(event.target.value as typeof operator)}
              >
                <option value="MTN">MTN</option>
                <option value="ORANGE">Orange</option>
              </select>
            </Field>
          ) : null}

          <Field label="Numéro">
            <input
              className={INPUT}
              required
              maxLength={50}
              value={number}
              onChange={(event) => setNumber(event.target.value)}
            />
          </Field>

          <Field
            label="Nom du titulaire"
            hint="Il doit correspondre au nom de l’agence ; c’est ce que le vérificateur compare."
          >
            <input
              className={INPUT}
              required
              maxLength={150}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          {error === null ? null : <ErrorNote message={describeError(error)} />}

          <Button
            type="submit"
            label="Déclarer ce compte"
            disabled={number.trim() === '' || name.trim() === ''}
          />
        </form>
      )}
    </Panel>
  )
}
