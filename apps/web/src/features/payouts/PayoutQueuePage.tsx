import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { newIdempotencyKey, unwrap } from '@motoboy/api-client'
import type { Payout } from '@motoboy/api-client/types'
import { formatMoney } from '@motoboy/shared'
import { api } from '../../lib/api'
import { describeError } from '../../lib/errors'
import { Button, EmptyState, ErrorNote, SkeletonTable } from '../../shared/ui'

function usePayouts() {
  return useQuery({
    queryKey: ['payouts'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/v1/admin/payouts', { signal })),
  })
}

/**
 * Valider puis envoyer.
 *
 * **Deux gestes et non un.** Valider dit « ce montant est juste » ; envoyer fait
 * partir l'argent. Les fondre supprimerait le seul moment où quelqu'un regarde
 * un décaissement avant qu'il soit irréversible.
 */
function usePayoutAction(kind: 'approve' | 'send') {
  const queryClient = useQueryClient()
  const [key] = useState(newIdempotencyKey)

  return useMutation({
    mutationFn: async (reference: string) => {
      if (kind === 'approve') {
        return unwrap(
          await api.POST('/v1/admin/payouts/{reference}/approve', {
            params: { path: { reference } },
          }),
        )
      }

      /*
       * La clé est tenue par le composant et **survit aux réessais** : en
       * regénérer une à chaque tentative reviendrait à ne pas avoir
       * d'idempotence, et un décaissement joué deux fois ne se rattrape pas.
       */
      return unwrap(
        await api.POST('/v1/admin/payouts/{reference}/send', {
          // Déclarée au contrat comme paramètre d'en-tête : la passer en en-tête
          // libre compilerait sans que le typage vérifie qu'elle est là.
          params: { path: { reference }, header: { 'Idempotency-Key': key } },
        }),
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payouts'] })
    },
  })
}

/**
 * Construire la file des reversements dus.
 *
 * **Le calcul est automatique, le déclenchement reste manuel** — c'est la raison
 * d'être de ce bouton. L'API parcourt les grands livres, crée un reversement par
 * agence qui a un solde, et **écarte les autres en disant pourquoi** : solde nul,
 * pas de compte vérifié, minimum non atteint. Ces écarts comptent autant que les
 * créations, parce qu'une agence qui attend son argent veut savoir ce qui bloque.
 *
 * Rejouable sans dégât : une agence ayant déjà un reversement ouvert est écartée.
 */
function useBuildPayouts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => unwrap(await api.POST('/v1/admin/payouts/build', {})),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payouts'] }),
  })
}

/**
 * La file des reversements.
 *
 * Le calcul est automatique, **le déclenchement est manuel** : les premiers mois
 * produiront des cas non anticipés — remboursement arrivé en retard, course
 * contestée, coordonnées erronées — et un décaissement Mobile Money du mauvais
 * montant est quasi irréversible.
 */
export function PayoutQueuePage() {
  const payouts = usePayouts()
  const build = useBuildPayouts()

  const result = build.data as
    | { created?: unknown[]; skipped?: { agency_id?: number; reason?: string }[] }
    | undefined

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink-700">Reversements</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Vérifiez le bénéficiaire et la destination avant de valider. Un virement Mobile
          Money mal dirigé ne se récupère pas.
        </p>

        <div className="mt-3">
          <Button
            label={
              build.isPending ? 'Calcul en cours…' : 'Construire les reversements dus'
            }
            variant="secondary"
            disabled={build.isPending}
            onPress={() => build.mutate()}
          />
        </div>

        {build.error ? <ErrorNote message={describeError(build.error)} /> : null}

        {result === undefined ? null : (
          <div className="mt-2 text-sm">
            <p className="text-ink-700">
              {(result.created ?? []).length} reversement
              {(result.created ?? []).length > 1 ? 's' : ''} créé
              {(result.created ?? []).length > 1 ? 's' : ''}.
            </p>
            {/*
              Les écartées sont nommées avec leur motif. Une agence absente de la
              file sans explication ressemble à un oubli de la plateforme, alors
              que c'est presque toujours un compte non vérifié.
            */}
            {(result.skipped ?? []).length === 0 ? null : (
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-neutral-500">
                {(result.skipped ?? []).map((row, index) => (
                  <li key={row.agency_id ?? index}>
                    Agence {row.agency_id ?? '—'} écartée :{' '}
                    {row.reason ?? 'motif inconnu'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>

      {payouts.isPending ? <SkeletonTable columns={4} rows={3} /> : null}

      {payouts.error ? <ErrorNote message={describeError(payouts.error)} /> : null}

      {payouts.data?.data.length === 0 ? (
        <EmptyState title="Aucun reversement en attente" />
      ) : null}

      <ul className="space-y-3">
        {payouts.data?.data.map((payout) => (
          <PayoutCard key={payout.reference} payout={payout} />
        ))}
      </ul>
    </div>
  )
}

function PayoutCard({ payout }: { payout: Payout }) {
  const approve = usePayoutAction('approve')
  const send = usePayoutAction('send')
  const [confirming, setConfirming] = useState(false)

  const pending = payout.status === 'PENDING_VALIDATION'
  const approved = payout.status === 'APPROVED'

  /*
   * Un compte non vérifié ne devrait jamais porter un reversement — `BuildPayout`
   * l'exclut. Si l'écran en voit un, c'est que quelque chose a changé après
   * construction, et il vaut mieux le dire que le laisser partir.
   */
  const destination = payout.destination
  const risky = destination !== null && destination !== undefined && !destination.verified

  return (
    <li className="rounded-xl bg-neutral-0 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {/* Le nom d'abord : c'est la question que se pose celui qui valide. */}
          <p className="text-lg font-semibold text-neutral-900">
            {payout.payee.name ?? '— bénéficiaire inconnu —'}
          </p>
          <p className="text-sm text-neutral-500">
            {payout.payee.kind === 'DRIVER' ? 'Chauffeur' : 'Agence'}
            {payout.payee.phone === null ? '' : ` · ${payout.payee.phone}`}
            {' · '}
            <span className="font-mono">{payout.reference}</span>
          </p>
        </div>

        <div className="text-right">
          <p className="text-xl font-bold text-brand-600">
            {formatMoney(payout.net, 'fr')}
          </p>
          <p className="text-xs text-neutral-500">{payout.status}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-neutral-50 p-3">
        <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
          Destination
        </p>
        {destination === null || destination === undefined ? (
          <p className="mt-1 text-sm text-danger">Aucun compte rattaché.</p>
        ) : (
          <p className="mt-1 text-sm">
            <span className="font-medium">{destination.account_name ?? '—'}</span>
            {' · '}
            {destination.operator ?? '—'}
            {' · '}
            <span className="font-mono">{destination.masked_number}</span>
            {risky ? (
              <span className="ml-2 rounded bg-danger-soft px-2 py-0.5 text-xs text-danger-strong">
                compte non vérifié
              </span>
            ) : null}
          </p>
        )}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-700">
        <div className="flex gap-2">
          <dt className="text-neutral-500">Brut</dt>
          <dd>{formatMoney(payout.gross, 'fr')}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-neutral-500">Commission</dt>
          <dd>−{formatMoney(payout.commission, 'fr')}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-neutral-500">Remboursements</dt>
          <dd>−{formatMoney(payout.refunds, 'fr')}</dd>
        </div>
      </dl>

      {pending ? (
        <button
          type="button"
          disabled={approve.isPending}
          onClick={() => approve.mutate(payout.reference)}
          className="mt-5 rounded-lg bg-ink-700 px-4 py-2 text-sm font-semibold text-neutral-0 hover:bg-ink-900 disabled:opacity-50"
        >
          Valider le montant
        </button>
      ) : null}

      {approved ? (
        <div className="mt-5">
          {confirming ? (
            <div className="rounded-lg bg-brand-50 p-4">
              <p className="text-sm text-neutral-900">
                Envoyer <strong>{formatMoney(payout.net, 'fr')}</strong> à{' '}
                <strong>{payout.payee.name}</strong> sur{' '}
                <span className="font-mono">{destination?.masked_number}</span> ? Ce
                virement ne se rattrape pas.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={send.isPending}
                  onClick={() =>
                    send.mutate(payout.reference, {
                      onSuccess: () => setConfirming(false),
                    })
                  }
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-neutral-0 hover:bg-brand-600 disabled:opacity-50"
                >
                  Envoyer l’argent
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
              Envoyer
            </button>
          )}
        </div>
      ) : null}

      {payout.failure_reason === null || payout.failure_reason === undefined ? null : (
        <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger-strong">
          {payout.failure_reason}
        </p>
      )}

      {approve.error || send.error ? (
        <ErrorNote message={describeError(approve.error ?? send.error)} />
      ) : null}
    </li>
  )
}
