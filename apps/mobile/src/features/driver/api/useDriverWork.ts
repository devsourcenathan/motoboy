import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unwrap } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'
import { invalidateDriver } from './useDriver'

async function fetchOpenRequests() {
  const response = await api.GET('/v1/driver/requests')

  return unwrap(response)
}

export type OpenRequest = Awaited<ReturnType<typeof fetchOpenRequests>>['data'][number]

/**
 * Les demandes ouvertes de sa ville.
 *
 * **Pas de sondage automatique** (C4) : le chauffeur regarde cet écran quand il
 * cherche du travail, pas en continu. Un rafraîchissement toutes les dix
 * secondes consommerait son forfait pendant qu'il conduit. Il tire pour
 * rafraîchir, et l'écran se recharge quand il y revient.
 */
export function useOpenRequests() {
  return useQuery({
    queryKey: queryKeys.driverRequests(),
    queryFn: fetchOpenRequests,
    // Ce que l'écran montre a une durée de vie : une demande peut être pourvue
    // pendant la lecture. Revenir dessus doit redemander.
    staleTime: 0,
  })
}

/**
 * Propose un prix et un délai.
 *
 * Les échecs attendus sont métier : dossier non validé, demande expirée, offre
 * déjà déposée, course en cours. Tous arrivent en 409 ou 403 avec un code, et
 * c'est le message de l'API qui est montré — le client n'a pas à rejouer ces
 * règles, il les rejouerait de travers.
 */
export function useMakeOffer(reference: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (offer: { price: number; etaMinutes: number }) => {
      const response = await api.POST('/v1/service-requests/{reference}/offers', {
        params: { path: { reference } },
        body: { price_amount: offer.price, eta_minutes: offer.etaMinutes },
      })

      return unwrap(response)
    },
    onSuccess: () => invalidateDriver(queryClient),
  })
}

export function useMyOffers() {
  return useQuery({
    queryKey: queryKeys.driverOffers(),
    queryFn: async () => unwrap(await api.GET('/v1/driver/offers')),
  })
}

async function fetchMyRides() {
  const response = await api.GET('/v1/driver/rides')

  return unwrap(response)
}

export type DriverRide = Awaited<ReturnType<typeof fetchMyRides>>['data'][number]

export function useMyRides() {
  return useQuery({
    queryKey: queryKeys.driverRides(),
    queryFn: fetchMyRides,
  })
}

/**
 * Démarrer et terminer.
 *
 * Deux mutations distinctes plutôt qu'une avec un paramètre : ce sont deux
 * gestes différents à deux moments différents, et l'écran doit pouvoir dire
 * lequel est en cours.
 */
export function useStartRide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reference: string) =>
      unwrap(
        await api.POST('/v1/driver/rides/{reference}/start', {
          params: { path: { reference } },
        }),
      ),
    onSuccess: () => invalidateDriver(queryClient),
  })
}

export function useCompleteRide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reference: string) =>
      unwrap(
        await api.POST('/v1/driver/rides/{reference}/complete', {
          params: { path: { reference } },
        }),
      ),
    onSuccess: () => invalidateDriver(queryClient),
  })
}
