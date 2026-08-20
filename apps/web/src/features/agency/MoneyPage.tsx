import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { unwrap } from '@motoboy/api-client'
import { formatMoney } from '@motoboy/shared'
import { api, session } from '../../lib/api'
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
 * Télécharger le relevé d'un reversement.
 *
 * **Pas un `<a href>`, et c'est la difficulté.** L'endpoint est authentifié : un
 * lien ordinaire partirait sans le jeton et rapporterait un 401 que le navigateur
 * afficherait comme une page d'erreur, hors de l'application. On récupère donc le
 * CSV par le client authentifié, puis on fabrique le téléchargement depuis un
 * objet mémoire.
 *
 * `URL.revokeObjectURL` n'est pas facultatif : chaque objet non révoqué retient
 * son contenu jusqu'au rechargement de l'onglet, et un comptable qui exporte
 * vingt relevés d'affilée les garderait tous en mémoire.
 */
async function downloadStatement(reference: string): Promise<void> {
  const response = await fetch(
    `${import.meta.env['VITE_API_URL'] ?? 'http://localhost:8000/api'}/v1/agency/payouts/${reference}/statement`,
    { headers: { Authorization: `Bearer ${(await session.token()) ?? ''}` } },
  )

  if (!response.ok) {
    throw new Error(`Relevé indisponible (${response.status}).`)
  }

  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')

  link.href = url
  link.download = `releve-${reference}.csv`
  link.click()

  URL.revokeObjectURL(url)
}

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
  const { t } = useTranslation()
  const ledger = useQuery({
    queryKey: ['agency', 'ledger'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/v1/agency/ledger', { signal })),
  })

  const payouts = useQuery({
    queryKey: ['agency', 'payouts'],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/agency/payouts', { signal })),
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
        title={t('agency:money.title')}
        subtitle={t('agency:money.subtitle')}
        action={
          <Button
            label={
              active === undefined
                ? t('agency:money.declareAccount')
                : t('agency:money.changeAccount')
            }
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
          {t('agency:money.payoutAccount')}
        </p>
        {accounts.isPending ? (
          <Skeleton rows={1} />
        ) : active === undefined ? (
          <p className="mt-1 text-sm text-danger">
            Aucun compte vérifié. Tant qu’il en manque un, aucun reversement ne peut
            partir.
          </p>
        ) : (
          <p className="mt-1 text-sm">
            <span className="font-medium">{active.account_name}</span> · {active.operator}{' '}
            · <span className="font-mono">{active.masked_number}</span>
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold text-neutral-900">
            {t('agency:money.payouts')}
          </h2>

          {payouts.isPending ? <Skeleton rows={3} /> : null}
          {payouts.error ? <ErrorNote message={describeError(payouts.error)} /> : null}

          {payouts.data !== undefined && (payouts.data.data ?? []).length === 0 ? (
            <EmptyState
              title={t('agency:money.noPayoutsTitle')}
              body={t('agency:money.noPayoutsBody')}
            />
          ) : (
            <Table
              head={[
                t('agency:money.head.reference'),
                t('agency:money.head.net'),
                t('agency:money.head.status'),
                '',
              ]}
            >
              {(payouts.data?.data ?? []).map((payout) => (
                <tr key={payout.reference}>
                  <Cell className="font-mono">{payout.reference}</Cell>
                  <Cell className="font-semibold">{formatMoney(payout.net, 'fr')}</Cell>
                  <Cell>{payout.status}</Cell>
                  <Cell>
                    {/*
                      Le relevé détaille réservation par réservation ce qui compose
                      le net versé. C'est ce qu'on ouvre quand une agence conteste
                      un montant — et jusqu'ici, rien ne permettait de l'obtenir.
                    */}
                    <button
                      type="button"
                      className="text-sm text-ink-500 underline"
                      onClick={() => {
                        void downloadStatement(payout.reference)
                      }}
                    >
                      Relevé CSV
                    </button>
                  </Cell>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-semibold text-neutral-900">
            {t('agency:money.ledger')}
          </h2>

          {ledger.isPending ? <Skeleton rows={3} /> : null}
          {ledger.error ? <ErrorNote message={describeError(ledger.error)} /> : null}

          {ledger.data !== undefined && entries.length === 0 ? (
            <EmptyState
              title={t('agency:money.noLedgerTitle')}
              body={t('agency:money.noLedgerBody')}
            />
          ) : (
            <Table
              head={[
                t('agency:money.head.date'),
                t('agency:money.head.label'),
                t('agency:money.head.amount'),
              ]}
            >
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
  const { t } = useTranslation()
  const [type, setType] = useState<'MOBILE_MONEY' | 'BANK'>('MOBILE_MONEY')
  const [operator, setOperator] = useState<'MTN' | 'ORANGE'>('MTN')
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [sent, setSent] = useState(false)

  return (
    <Panel title={t('agency:money.payoutAccount')} onClose={onClose}>
      {sent ? (
        <p className="rounded-lg bg-success-50 p-3 text-sm text-success-700">
          Déclaré. MOTOBOY vérifie ce compte avant qu’un virement puisse y partir ; le
          compte précédent reste actif jusque-là.
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
            Ce compte est vérifié par MOTOBOY avant d’être utilisé. Un virement mal dirigé
            ne se récupère pas.
          </p>

          <Field label={t('agency:money.type')}>
            <select
              className={INPUT}
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
            >
              <option value="MOBILE_MONEY">{t('agency:money.mobileMoney')}</option>
              <option value="BANK">{t('agency:money.bank')}</option>
            </select>
          </Field>

          {type === 'MOBILE_MONEY' ? (
            <Field label={t('agency:money.operator')}>
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

          <Field label={t('agency:money.number')}>
            <input
              className={INPUT}
              required
              maxLength={50}
              value={number}
              onChange={(event) => setNumber(event.target.value)}
            />
          </Field>

          <Field label={t('agency:money.holder')} hint={t('agency:money.holderHint')}>
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
            label={t('agency:money.declare')}
            disabled={number.trim() === '' || name.trim() === ''}
          />
        </form>
      )}
    </Panel>
  )
}
