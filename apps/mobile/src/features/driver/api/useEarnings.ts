import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unwrap } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys, QUERY_ROOT } from '../../../shared/api/queryKeys'

async function fetchEarnings() {
  const response = await api.GET('/v1/driver/earnings')

  return unwrap(response)
}

export type Earnings = Awaited<ReturnType<typeof fetchEarnings>>

/**
 * Son solde, son historique, ses reversements (C8).
 *
 * Rien n'est persisté sur le disque : le cache est écrit en clair, et un solde
 * comme un numéro de compte n'ont pas à rester lisibles sur un téléphone qui
 * change de mains. La racine `driver` est absente de `PERSISTED_ROOTS`, ce qui
 * suffit.
 */
export function useEarnings() {
  return useQuery({
    queryKey: queryKeys.driverEarnings(),
    queryFn: fetchEarnings,
  })
}

export function usePayoutAccounts() {
  return useQuery({
    queryKey: queryKeys.driverPayoutAccounts(),
    queryFn: async () => unwrap(await api.GET('/v1/driver/payout-accounts')),
  })
}

export interface PayoutAccountForm {
  readonly operator: 'MTN' | 'ORANGE'
  readonly number: string
  readonly name: string
}

/**
 * Déclare où verser (C9).
 *
 * Le compte reste **inactif jusqu'à vérification** par un administrateur, et
 * l'écran le dit : laisser croire que le virement peut partir ferait attendre un
 * argent bloqué sur une étape invisible.
 */
export function useSubmitPayoutAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (form: PayoutAccountForm) => {
      const response = await api.POST('/v1/driver/payout-accounts', {
        body: {
          type: 'MOBILE_MONEY',
          operator: form.operator,
          account_number: form.number.trim(),
          account_name: form.name.trim(),
        },
      })

      return unwrap(response)
    },
    onSuccess: () => {
      // Le solde n'a pas bougé, mais le motif « pas de compte vérifié » a
      // changé d'état : les deux écrans lisent la même racine.
      void queryClient.invalidateQueries({ queryKey: [QUERY_ROOT.driver] })
    },
  })
}
