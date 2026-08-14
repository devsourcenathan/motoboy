import { useQuery } from '@tanstack/react-query'
import { unwrap, type SeatMap, type TripDetail } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'

/**
 * Le plan de sièges vieillit vite.
 *
 * Une place libre il y a une minute peut être tenue maintenant. Trente secondes
 * est un compromis : assez court pour que le passager ne choisisse pas une
 * place déjà partie, assez long pour ne pas rappeler le serveur à chaque
 * pression. **Le serveur tranche de toute façon** — l'index unique refuse la
 * double-vente, et l'écran n'est qu'un affichage (§29).
 */
const SEATS_STALE_MS = 30_000

export function useTrip(reference: string) {
  return useQuery({
    queryKey: queryKeys.trip(reference),
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/trips/{reference}', {
        params: { path: { reference } },
        signal,
      })

      return unwrap(response) as TripDetail
    },
  })
}

export function useSeatMap(reference: string) {
  return useQuery({
    queryKey: queryKeys.tripSeats(reference),
    staleTime: SEATS_STALE_MS,
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/trips/{reference}/seats', {
        params: { path: { reference } },
        signal,
      })

      return unwrap(response) as SeatMap
    },
  })
}
