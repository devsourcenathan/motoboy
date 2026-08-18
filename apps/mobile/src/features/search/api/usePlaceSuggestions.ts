import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { unwrap, type PlaceSuggestion } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'

/**
 * En deçà de deux caractères, on n'envoie pas la saisie — mais on interroge
 * quand même : le serveur rend alors les villes les plus utiles.
 *
 * Une seule lettre ne filtre presque rien et coûte une requête par frappe ; zéro
 * caractère, en revanche, est une question à part entière — « que desservez-vous ? »
 */
export const MIN_QUERY_LENGTH = 2

/** Ce que le serveur rend quand rien n'est saisi. */
export const DEFAULT_CITY_COUNT = 20

/**
 * Le temps qu'on laisse à la frappe avant d'interroger le serveur.
 *
 * Une requête par caractère saturerait une connexion de gare et ferait
 * clignoter la liste. 250 ms est court assez pour paraître instantané, long
 * assez pour absorber une saisie normale.
 */
const DEBOUNCE_MS = 250

function useDebounced(value: string, delay = DEBOUNCE_MS): string {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}

/**
 * Autocomplétion des villes et gares.
 *
 * Le référentiel est **fermé et curé par MOTOBOY** : c'est ce qui fait que
 * « Douala », « douala » et « Dla » ramènent la même ville, et donc que les
 * offres de plusieurs agences se regroupent (B1).
 */
export function usePlaceSuggestions(query: string) {
  const settled = useDebounced(query.trim())

  /*
   * Une saisie d'une seule lettre ne filtre presque rien : on garde la liste par
   * défaut plutôt que d'envoyer une requête à chaque frappe pour un résultat qui
   * ressemblerait au précédent.
   */
  const searching = settled.length >= MIN_QUERY_LENGTH
  const term = searching ? settled : ''

  const result = useQuery({
    queryKey: queryKeys.places(term),
    // La liste précédente reste affichée pendant la frappe suivante : la vider
    // à chaque lettre ferait sauter la mise en page sous le doigt.
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/places/autocomplete', {
        // `q` omise plutôt qu'envoyée vide : le contrat la déclare facultative,
        // et une chaîne vide serait refusée par `min:2`.
        params: {
          query: term === ''
            ? { limit: DEFAULT_CITY_COUNT }
            : { q: term, limit: DEFAULT_CITY_COUNT },
        },
        signal,
      })

      return unwrap(response).data
    },
  })

  return {
    ...result,
    suggestions: (result.data ?? []) as PlaceSuggestion[],
  }
}
