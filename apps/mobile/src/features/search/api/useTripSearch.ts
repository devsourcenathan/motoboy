import { useQuery } from '@tanstack/react-query'
import { unwrap, type SearchSuggestions, type TripSummary } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'

export interface SearchCriteria {
  readonly from: number
  readonly to: number
  /** `YYYY-MM-DD`. */
  readonly date: string
}

/**
 * La requête centrale du produit.
 *
 * Le filtrage porte sur le **couple de villes** : la réservation étant
 * point-à-point, une ville d'escale ne rend pas un départ éligible (B6). Les
 * départs dont la vente en ligne est close n'apparaissent pas — le passager ne
 * pourrait de toute façon pas les réserver.
 *
 * La réponse porte toujours un bloc `suggestions`, y compris quand `data` est
 * vide : un seul aller-retour, et l'écran a toujours quelque chose à montrer.
 * La couverture sera faible au lancement, et **un passager déçu deux fois ne
 * revient pas**.
 */
export function useTripSearch(criteria: SearchCriteria | null) {
  const result = useQuery({
    queryKey: criteria
      ? queryKeys.search(criteria)
      : queryKeys.search({ from: 0, to: 0, date: '' }),
    enabled: criteria !== null,
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/search', {
        params: {
          query: {
            origin_city_id: criteria!.from,
            destination_city_id: criteria!.to,
            date: criteria!.date,
          },
        },
        signal,
      })

      return unwrap(response)
    },
  })

  return {
    ...result,
    trips: (result.data?.data ?? []) as TripSummary[],
    suggestions: result.data?.suggestions as SearchSuggestions | undefined,
  }
}
