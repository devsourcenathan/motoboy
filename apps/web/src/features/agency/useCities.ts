import { useQuery } from '@tanstack/react-query'
import { unwrap } from '@motoboy/api-client'
import { api } from '../../lib/api'

/**
 * Recherche dans le référentiel géographique.
 *
 * **Fermé et curé par MOTOBOY** : c'est lui qui fait que « Douala », « douala »
 * et « Dla » désignent la même ville, et donc que les offres de plusieurs
 * agences se regroupent sur une même recherche (B1). Une saisie libre créerait
 * autant de villes que d'orthographes.
 *
 * Sans saisie, l'endpoint rend les villes les plus utiles : le champ n'est jamais
 * vide, et une agence découvre ce que la plateforme dessert.
 */
export function useCitySearch(query: string) {
  const term = query.trim()

  return useQuery({
    queryKey: ['cities', term.length >= 2 ? term : ''],
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/places/autocomplete', {
        params: { query: term.length >= 2 ? { q: term, limit: 10 } : { limit: 10 } },
        signal,
      })

      /*
       * Seules les villes : une gare se rattache à une ville, et proposer une
       * autre gare comme rattachement n'aurait pas de sens.
       */
      return unwrap(response).data.filter((place) => place.type === 'CITY')
    },
  })
}
