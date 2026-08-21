import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { unwrap } from '@motoboy/api-client'
import { formatMoney } from '@motoboy/shared'
import { api, session } from '../../lib/api'
import { describeError } from '../../lib/errors'
import {
  Button,
  Badge,
  Card,
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  Actions,
  Sheet,
  SheetForm,
  SkeletonTable,
  SkeletonText,
  type Tone,
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
/*
 * Les types viennent des **requêtes elles-mêmes**, par `ReturnType`, et non
 * d'une forme réécrite à la main sous les composants. Recopier la réponse ici
 * la ferait diverger du contrat sans que rien ne le signale.
 */
type LedgerQuery = ReturnType<typeof useLedger>
type PayoutQuery = ReturnType<typeof usePayouts>
type LedgerEntry = NonNullable<LedgerQuery['data']>['data'][number]
type PayoutAccount = NonNullable<
  ReturnType<typeof usePayoutAccounts>['data']
>['data'][number]

/** Le statut d'un reversement, dit par la couleur autant que par le mot. */
const PAYOUT_TONES: Record<string, Tone> = {
  PAID: 'good',
  FAILED: 'alert',
  PROCESSING: 'action',
  APPROVED: 'action',
}

function useLedger() {
  return useQuery({
    queryKey: ['agency', 'ledger'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/v1/agency/ledger', { signal })),
  })
}

function usePayouts() {
  return useQuery({
    queryKey: ['agency', 'payouts'],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/agency/payouts', { signal })),
  })
}

function usePayoutAccounts() {
  return useQuery({
    queryKey: ['agency', 'payout-accounts'],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/agency/payout-accounts', { signal })),
  })
}

export function MoneyPage() {
  const { t } = useTranslation()
  const ledger = useLedger()
  const payouts = usePayouts()
  const accounts = usePayoutAccounts()

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
      <ActiveAccount account={active} pending={accounts.isPending} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Payouts query={payouts} />
        <Ledger query={ledger} entries={entries} />
      </div>

      {declaring ? <AccountPanel onClose={() => setDeclaring(false)} /> : null}
    </div>
  )
}

/**
 * La destination des virements.
 *
 * **En premier, et seule dans sa carte.** C'est la seule chose de cette page sur
 * laquelle l'agence peut agir, et son absence bloque tout reversement —
 * silencieusement, du point de vue de qui attend son argent.
 */
function ActiveAccount({
  account,
  pending,
}: {
  account: PayoutAccount | undefined
  pending: boolean
}) {
  const { t } = useTranslation()

  return (
    <Card className="mb-6">
      <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
        {t('agency:money.payoutAccount')}
      </p>
      {pending ? (
        <div className="mt-2">
          <SkeletonText lines={1} />
        </div>
      ) : account === undefined ? (
        <p className="mt-1 text-sm text-danger">
          Aucun compte vérifié. Tant qu’il en manque un, aucun reversement ne peut partir.
        </p>
      ) : (
        <p className="mt-1 text-sm">
          <span className="font-medium">{account.account_name}</span> · {account.operator}{' '}
          · <span className="font-mono">{account.masked_number}</span>
        </p>
      )}
    </Card>
  )
}

/**
 * Les reversements reçus.
 *
 * Le relevé détaille réservation par réservation ce qui compose le net versé.
 * C'est ce qu'on ouvre quand une agence conteste un montant — et jusqu'ici,
 * rien ne permettait de l'obtenir.
 */
function Payouts({ query }: { query: PayoutQuery }) {
  const { t } = useTranslation()
  const rows = query.data?.data ?? []

  return (
    <section>
      <h2 className="mb-3 font-semibold text-neutral-900">{t('agency:money.payouts')}</h2>

      {query.isPending ? <SkeletonTable columns={4} rows={3} /> : null}
      {query.error ? <ErrorNote message={describeError(query.error)} /> : null}

      {query.data !== undefined && rows.length === 0 ? (
        <EmptyState
          title={t('agency:money.noPayoutsTitle')}
          body={t('agency:money.noPayoutsBody')}
        />
      ) : null}

      {rows.length === 0 ? null : (
        <Table
          head={[
            t('agency:money.head.reference'),
            t('agency:money.head.net'),
            t('agency:money.head.status'),
            '',
          ]}
        >
          {rows.map((payout) => (
            <tr key={payout.reference}>
              <Cell className="font-mono">{payout.reference}</Cell>
              <Cell className="font-semibold tabular-nums">
                {formatMoney(payout.net, 'fr')}
              </Cell>
              <Cell>
                <Badge
                  label={payout.status}
                  tone={PAYOUT_TONES[payout.status] ?? 'neutral'}
                />
              </Cell>
              <Cell>
                <Button
                  label="Relevé CSV"
                  variant="ghost"
                  size="sm"
                  icon="document"
                  onPress={() => {
                    void downloadStatement(payout.reference)
                  }}
                />
              </Cell>
            </tr>
          ))}
        </Table>
      )}
    </section>
  )
}

/** Ce qui a bougé, dans l'ordre où c'est arrivé. */
function Ledger({
  query,
  entries,
}: {
  query: LedgerQuery
  entries: readonly LedgerEntry[]
}) {
  const { t } = useTranslation()

  return (
    <section>
      <h2 className="mb-3 font-semibold text-neutral-900">{t('agency:money.ledger')}</h2>

      {query.isPending ? <SkeletonTable columns={3} rows={3} /> : null}
      {query.error ? <ErrorNote message={describeError(query.error)} /> : null}

      {query.data !== undefined && entries.length === 0 ? (
        <EmptyState
          title={t('agency:money.noLedgerTitle')}
          body={t('agency:money.noLedgerBody')}
        />
      ) : null}

      {entries.length === 0 ? null : (
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
                Le signe est porté par la couleur autant que par le chiffre : un
                relevé se parcourt du regard, et un « −800 » au milieu de crédits
                se manque.
              */}
              <Cell
                className={`text-right font-medium tabular-nums ${
                  entry.amount.amount < 0 ? 'text-danger' : 'text-success-700'
                }`}
              >
                {formatMoney(entry.amount, 'fr')}
              </Cell>
            </tr>
          ))}
        </Table>
      )}
    </section>
  )
}

/**
 * Déclarer un compte de versement.
 *
 * **Une mutation, comme partout ailleurs.** Cet écran appelait l'API à la main
 * — un `.then()`, une erreur rangée dans un état local, aucune notion d'attente
 * — quand les onze autres passent par `useMutation`. Deux façons de parler au
 * serveur dans un même produit finissent par diverger sur ce qui compte : ici,
 * rien ne montrait l'envoi en cours, et rien n'invalidait la liste derrière.
 *
 * Deux états, et le panneau change de nature entre eux : tant que rien n'est
 * envoyé c'est un formulaire, une fois déclaré c'est un accusé de réception —
 * qui n'a pas de bouton « envoyer », seulement de quoi refermer.
 */
/**
 * Déclarer un compte de versement.
 *
 * `invalidateQueries` sur la liste : sans cela, le compte déclaré n'apparaît pas
 * derrière le panneau qu'on vient de fermer, et l'on redéclare le même — ce que
 * le code précédent faisait, faute de passer par une mutation.
 */
function useDeclarePayoutAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: {
      type: 'MOBILE_MONEY' | 'BANK'
      operator?: 'MTN' | 'ORANGE'
      account_number: string
      account_name: string
    }) => unwrap(await api.POST('/v1/agency/payout-accounts', { body })),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['agency', 'payout-accounts'] }),
  })
}

function AccountPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [type, setType] = useState<'MOBILE_MONEY' | 'BANK'>('MOBILE_MONEY')
  const [operator, setOperator] = useState<'MTN' | 'ORANGE'>('MTN')
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')

  const declare = useDeclarePayoutAccount()

  if (declare.isSuccess) {
    return (
      <Sheet
        title={t('agency:money.payoutAccount')}
        onClose={onClose}
        footer={
          <Actions>
            <Button label="Fermer" onPress={onClose} />
          </Actions>
        }
      >
        <p className="rounded-lg bg-success-50 p-3 text-sm text-success-700">
          Déclaré. MOTOBOY vérifie ce compte avant qu’un virement puisse y partir ; le
          compte précédent reste actif jusque-là.
        </p>
      </Sheet>
    )
  }

  return (
    <SheetForm
      title={t('agency:money.payoutAccount')}
      onClose={onClose}
      submitLabel={t('agency:money.declare')}
      submitDisabled={number.trim() === '' || name.trim() === ''}
      pending={declare.isPending}
      error={declare.error ? describeError(declare.error) : undefined}
      onSubmit={() =>
        declare.mutate({
          type,
          ...(type === 'MOBILE_MONEY' ? { operator } : {}),
          account_number: number.trim(),
          account_name: name.trim(),
        })
      }
    >
      {/*
        Dit avant la saisie : une erreur de numéro envoie l'argent à un
        inconnu, sans recours. C'est pour cela que MOTOBOY vérifie, et
        l'expliquer évite qu'une agence s'inquiète du délai.
      */}
      <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
        Ce compte est vérifié par MOTOBOY avant d’être utilisé. Un virement mal dirigé ne
        se récupère pas.
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
    </SheetForm>
  )
}
