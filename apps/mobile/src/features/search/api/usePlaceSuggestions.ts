import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { unwrap, type PlaceSuggestion } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'

/** Le contrat exige deux caractères. En deçà, aucune requête n'est envoyée. */
export const MIN_QUERY_LENGTH = 2

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
  const enabled = settled.length >= MIN_QUERY_LENGTH

  const result = useQuery({
    queryKey: queryKeys.places(settled),
    enabled,
    // La liste précédente reste affichée pendant la frappe suivante : la vider
    // à chaque lettre ferait sauter la mise en page sous le doigt.
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/places/autocomplete', {
        params: { query: { q: settled } },
        signal,
      })

      return unwrap(response).data
    },
  })

  return {
    ...result,
    suggestions: (result.data ?? []) as PlaceSuggestion[],
    /** Vrai tant que la saisie est trop courte pour interroger le serveur. */
    tooShort: settled.length > 0 && !enabled,
  }
}
