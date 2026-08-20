import { useQuery } from '@tanstack/react-query'
import { unwrap, type SearchSuggestions, type TripSummary } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'

/**
 * Les ordres que le contrat expose.
 *
 * Le prix pèse lourd dans le classement du MVP : c'est le premier critère de
 * comparaison entre deux agences qui desservent la même liaison.
 */
export const SEARCH_SORTS = [
  'best',
  'price_asc',
  'departure_asc',
  'duration_asc',
] as const

export type SearchSort = (typeof SEARCH_SORTS)[number]

/**
 * Ce que le contrat sait filtrer.
 *
 * La maquette montre aussi une fourchette de prix et une plage horaire ;
 * l'API n'en propose ni l'une ni l'autre. Les dessiner obligerait à filtrer
 * après coup, sur la seule page reçue — ce qui donnerait un résultat faux dès
 * qu'il y a plus d'une page.
 */
/**
 * Tranches horaires plutôt qu'un curseur à deux poignées.
 *
 * Le contrat prend `departure_from`/`departure_to` en heures locales, donc un
 * intervalle libre serait possible — mais viser deux poignées au pouce dans un
 * car en marche rate une fois sur deux, et personne ne cherche « entre 07:20 et
 * 13:40 ». On cherche le matin.
 */
export const PERIODS = {
  ANY: null,
  MORNING: { from: '00:00', to: '11:59' },
  AFTERNOON: { from: '12:00', to: '17:59' },
  EVENING: { from: '18:00', to: '23:59' },
} as const

export type Period = keyof typeof PERIODS

/**
 * Tranches de prix, en XAF — la monnaie n'a pas de sous-unité, donc les bornes
 * sont exactes et ne peuvent pas se chevaucher d'un centime.
 *
 * Des tranches plutôt qu'une fourchette libre, pour la même raison que les
 * horaires : personne ne cherche « entre 4 200 et 7 850 ».
 */
export const PRICE_BRACKETS = {
  ANY: null,
  LOW: { min: null, max: 4_999 },
  MID: { min: 5_000, max: 9_999 },
  HIGH: { min: 10_000, max: null },
} as const

export type PriceBracket = keyof typeof PRICE_BRACKETS

export interface SearchFilters {
  readonly agencyIds: readonly number[]
  readonly vehicleType: 'BUS' | 'CAR' | null
  readonly onlyAvailable: boolean
  readonly period: Period
  readonly price: PriceBracket
}

export const NO_FILTERS: SearchFilters = {
  agencyIds: [],
  vehicleType: null,
  onlyAvailable: false,
  period: 'ANY',
  price: 'ANY',
}

export function countFilters(filters: SearchFilters): number {
  return (
    (filters.agencyIds.length > 0 ? 1 : 0) +
    (filters.vehicleType === null ? 0 : 1) +
    (filters.onlyAvailable ? 1 : 0) +
    (filters.period === 'ANY' ? 0 : 1) +
    (filters.price === 'ANY' ? 0 : 1)
  )
}

export interface SearchCriteria {
  readonly from: number
  readonly to: number
  /** `YYYY-MM-DD`. */
  readonly date: string
  readonly sort?: SearchSort
  readonly filters?: SearchFilters
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
      ? queryKeys.search({
          ...criteria,
          // Les filtres entrent dans la clé : deux jeux différents sont deux
          // réponses, et les confondre montrerait le résultat précédent.
          filters: [
            [...(criteria.filters?.agencyIds ?? [])].sort().join('-'),
            criteria.filters?.vehicleType ?? '',
            criteria.filters?.onlyAvailable === true ? 'avail' : '',
            criteria.filters?.period ?? 'ANY',
            criteria.filters?.price ?? 'ANY',
          ].join('|'),
        })
      : queryKeys.search({ from: 0, to: 0, date: '' }),
    enabled: criteria !== null,
    queryFn: async ({ signal }) => {
      const bracket = PRICE_BRACKETS[criteria!.filters?.price ?? 'ANY']

      const response = await api.GET('/v1/search', {
        params: {
          query: {
            origin_city_id: criteria!.from,
            destination_city_id: criteria!.to,
            date: criteria!.date,
            sort: criteria!.sort ?? 'best',
            // Omis quand vides : envoyer `agency_ids=[]` demanderait « aucune
            // agence » à un serveur qui comprend « toutes ».
            ...(criteria!.filters?.agencyIds.length
              ? { agency_ids: [...criteria!.filters.agencyIds] }
              : {}),
            ...(criteria!.filters?.vehicleType
              ? { vehicle_type: criteria!.filters.vehicleType }
              : {}),
            ...(criteria!.filters?.onlyAvailable === true
              ? { only_available: true }
              : {}),
            // Chaque borne n'est envoyée que si la tranche la définit : une
            // borne haute seule est une demande valable, et le serveur
            // l'accepte.
            ...(bracket?.min === null || bracket?.min === undefined
              ? {}
              : { price_min: bracket.min }),
            ...(bracket?.max === null || bracket?.max === undefined
              ? {}
              : { price_max: bracket.max }),
            ...(criteria!.filters?.period && criteria!.filters.period !== 'ANY'
              ? {
                  departure_from: PERIODS[criteria!.filters.period]!.from,
                  departure_to: PERIODS[criteria!.filters.period]!.to,
                }
              : {}),
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
