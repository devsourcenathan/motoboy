import { useQuery } from '@tanstack/react-query'
import { unwrap, type Booking } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'

/**
 * Les réservations du passager.
 *
 * Distinctes des billets : une réservation de trois places produit trois
 * billets, et c'est la réservation qui porte le paiement, le montant et
 * l'annulation. L'onglet « Mes voyages » raisonne donc par réservation,
 * l'onglet « Billets » par personne qui embarque.
 */
export function useBookings() {
  return useQuery({
    queryKey: queryKeys.bookings(),
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/bookings', { signal })

      // La collection est paginée : le contrat renvoie `{ data, meta }`, et
      // seule la page en cours est utile ici.
      const page = unwrap(response) as unknown as { data: Booking[] }

      return page.data
    },
  })
}
