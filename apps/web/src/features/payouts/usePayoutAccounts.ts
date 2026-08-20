import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unwrap } from '@motoboy/api-client'
import type { AdminPayoutAccountRow } from '@motoboy/api-client/types'
import { api } from '../../lib/api'

export type { AdminPayoutAccountRow }

export function usePayoutAccounts() {
  return useQuery({
    queryKey: ['payout-accounts'],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/admin/payout-accounts', { signal })),
  })
}

/**
 * Vérifier une destination de virement.
 *
 * **C'est le geste qui débloque l'argent.** Tant qu'il n'a pas eu lieu, le compte
 * reste inactif et la passe de reversement s'arrête sur `NO_VERIFIED_ACCOUNT` —
 * silencieusement, du point de vue du chauffeur qui attend.
 *
 * Il n'a pas de contraire : dé-vérifier n'existe pas. Une erreur se corrige en
 * faisant redéclarer un compte, ce qui laisse une trace, plutôt qu'en effaçant
 * une décision.
 */
export function useVerifyPayoutAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) =>
      unwrap(
        await api.POST('/v1/admin/payout-accounts/{id}/verify', {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payout-accounts'] })
    },
  })
}
