import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { newIdempotencyKey, unwrap, type Booking } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'
import { toRequestBody, type BookingForm } from '../model/passengerForm'

/**
 * Une clé d'idempotence, **conservée entre les tentatives**.
 *
 * C'est tout l'objet de la clé. En régénérer une à chaque essai reviendrait à
 * ne pas avoir d'idempotence du tout : une requête qui expire côté téléphone
 * mais aboutit côté serveur — cas banal sur une connexion de gare — ferait
 * alors tenir deux fois les places et payer deux fois.
 *
 * Elle ne se renouvelle qu'à `reset()`, c'est-à-dire quand le passager
 * recommence délibérément une autre réservation.
 */
function useStableIdempotencyKey() {
  const key = useRef<string | null>(null)

  const current = useCallback(() => {
    key.current ??= newIdempotencyKey()

    return key.current
  }, [])

  const reset = useCallback(() => {
    key.current = null
  }, [])

  return { current, reset }
}

/**
 * Crée la réservation et **tient les places**.
 *
 * Les places sont tenues dès cet appel, avant toute saisie de paiement : les
 * tenir seulement au moment de payer laisserait deux passagers saisir en
 * parallèle, et l'un des deux perdrait sa place au dernier écran (B2).
 *
 * Une réservation de plusieurs places est prise **en tout ou rien**.
 */
export function useCreateBooking(tripReference: string) {
  const queryClient = useQueryClient()
  const { current, reset } = useStableIdempotencyKey()

  const mutation = useMutation({
    mutationFn: async (form: BookingForm) => {
      const response = await api.POST('/v1/bookings', {
        params: { header: { 'Idempotency-Key': current() } },
        body: toRequestBody(form, tripReference),
      })

      return unwrap(response) as Booking
    },
    onSuccess: (booking) => {
      queryClient.setQueryData(queryKeys.booking(booking.reference), booking)

      // Le plan de sièges vient de changer : les places tenues ne sont plus
      // libres pour personne d'autre.
      void queryClient.invalidateQueries({ queryKey: queryKeys.tripSeats(tripReference) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings() })
    },
  })

  return { ...mutation, resetIdempotency: reset }
}
