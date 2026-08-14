import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import {
  newIdempotencyKey,
  unwrap,
  type Booking,
  type BookingCancellation,
  type CancellationQuote,
} from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'

export function useBooking(reference: string) {
  return useQuery({
    queryKey: queryKeys.booking(reference),
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/bookings/{reference}', {
        params: { path: { reference } },
        signal,
      })

      return unwrap(response) as Booking
    },
  })
}

/**
 * Ce que l'annulation coûtera, **sans rien exécuter**.
 *
 * Le devis précède toujours la confirmation : sans lui, le passager valide à
 * l'aveugle et découvre les frais retenus après coup, ce qui transforme une
 * règle acceptée en litige (B5). Il se recalcule à chaque changement de
 * sélection — annuler une place sur trois ne coûte pas le tiers de rien.
 */
export function useCancellationQuote(reference: string, passengerIds: readonly number[]) {
  return useQuery({
    queryKey: queryKeys.cancellationQuote(reference, passengerIds),
    // Les conditions dépendent du temps qui reste avant le départ : un devis
    // gardé en cache pourrait annoncer « gratuit » une fois le délai passé.
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/bookings/{reference}/cancellation-quote', {
        params: {
          path: { reference },
          query: passengerIds.length === 0 ? {} : { passenger_ids: [...passengerIds] },
        },
        signal,
      })

      return unwrap(response) as CancellationQuote
    },
  })
}

/**
 * Annule, totalement ou partiellement.
 *
 * ⚠️ **La clé d'idempotence est conservée entre les tentatives**, comme à la
 * réservation et contrairement au paiement. Une annulation rejouée doit rendre
 * la même annulation : en régénérer une ferait, sur une requête qui expire côté
 * téléphone mais aboutit côté serveur, annuler deux fois — et la seconde
 * porterait sur des passagers déjà annulés.
 */
export function useCancelBooking(reference: string) {
  const queryClient = useQueryClient()
  const key = useRef<string | null>(null)

  const idempotencyKey = useCallback(() => {
    key.current ??= newIdempotencyKey()

    return key.current
  }, [])

  return useMutation({
    mutationFn: async (passengerIds: readonly number[]) => {
      const response = await api.POST('/v1/bookings/{reference}/cancel', {
        params: { path: { reference }, header: { 'Idempotency-Key': idempotencyKey() } },
        body: passengerIds.length === 0 ? {} : { passenger_ids: [...passengerIds] },
      })

      return unwrap(response) as BookingCancellation
    },
    onSuccess: () => {
      // Les billets des passagers annulés ne sont plus valables, et la place
      // qu'ils tenaient repart à la vente.
      void queryClient.invalidateQueries({ queryKey: queryKeys.booking(reference) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tickets() })
    },
  })
}
