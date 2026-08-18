import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { newIdempotencyKey, unwrap } from '@motoboy/api-client'
import type { CounterSaleInput } from '@motoboy/api-client/types'
import { useRef } from 'react'
import { api } from '../../lib/api'

/**
 * L'exploitation quotidienne : départs, guichet, embarquement.
 *
 * C'est ici que l'agence passe ses journées, pas dans l'inventaire — celui-ci se
 * remplit une fois et se corrige rarement.
 */
const keys = {
  trips: ['agency', 'trips'] as const,
  seats: (reference: string) => ['agency', 'trips', reference, 'seats'] as const,
  boarding: (reference: string) => ['agency', 'trips', reference, 'boarding'] as const,
}

export function useAgencyTrips(params: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: [...keys.trips, params.from ?? '', params.to ?? ''],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/agency/trips', {
          params: { query: { ...(params.from === undefined ? {} : { from: params.from }) } },
          signal,
        }),
      ),
  })
}

export function useTripSeats(reference: string | null) {
  return useQuery({
    queryKey: keys.seats(reference ?? ''),
    enabled: reference !== null,
    // Le plan change à chaque vente : le garder en cache montrerait un siège
    // libre qui vient d'être pris, et le guichet vendrait deux fois.
    staleTime: 0,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/agency/trips/{reference}/seats', {
          params: { path: { reference: reference ?? '' } },
          signal,
        }),
      ),
  })
}

/**
 * La vente au guichet.
 *
 * **Le seul écran dont la vitesse est une exigence fonctionnelle** : plus lente
 * que le cahier papier, elle ne sera pas utilisée, et toute la fiabilité de la
 * disponibilité affichée s'effondre avec elle (I2).
 *
 * La clé d'idempotence est tenue dans une `ref` et **survit aux réessais** : sur
 * une connexion de gare, une requête qui expire côté client mais aboutit côté
 * serveur est banale, et en régénérer une reviendrait à vendre deux fois la même
 * place.
 */
export function useCounterSale() {
  const queryClient = useQueryClient()
  const key = useRef(newIdempotencyKey())

  return useMutation({
    mutationFn: async (body: CounterSaleInput) =>
      unwrap(
        await api.POST('/v1/agency/counter-sales', {
          params: { header: { 'Idempotency-Key': key.current } },
          body,
        }),
      ),
    onSuccess: () => {
      // Une vente aboutie ouvre la suivante : la clé précédente ne doit pas la
      // faire passer pour un rejeu.
      key.current = newIdempotencyKey()
      void queryClient.invalidateQueries({ queryKey: ['agency'] })
    },
  })
}

export function useBoardingList(reference: string | null) {
  return useQuery({
    queryKey: keys.boarding(reference ?? ''),
    enabled: reference !== null,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/agency/trips/{reference}/boarding-list', {
          params: { path: { reference: reference ?? '' } },
          signal,
        }),
      ),
  })
}

/**
 * Valide un billet à l'embarquement.
 *
 * L'API distingue un **renvoi** d'un **doublon** : sans cette distinction, chaque
 * coupure réseau fabriquerait un faux doublon et la statistique censée révéler un
 * vrai problème d'exploitation deviendrait du bruit.
 */
export function useValidateTicket(reference: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      ticketReference,
      method,
    }: {
      ticketReference: string
      method: 'SCAN' | 'MANUAL'
    }) =>
      unwrap(
        await api.POST('/v1/agency/trips/{reference}/validations', {
          params: {
            path: { reference },
            header: { 'Idempotency-Key': newIdempotencyKey() },
          },
          /*
           * Un lot, même pour une seule validation : l'endpoint est conçu pour la
           * file locale de la PWA, qui remonte ce qu'elle a accumulé hors ligne.
           * Le `client_id` est repris tel quel dans la réponse — c'est lui qui
           * permet de purger la bonne entrée de cette file.
           */
          body: {
            validations: [
              {
                client_id: newIdempotencyKey(),
                ticket_reference: ticketReference,
                validated_at: new Date().toISOString(),
                method,
              },
            ],
          },
        }),
      ),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: keys.boarding(reference) }),
  })
}

/**
 * Annule un départ.
 *
 * **Remboursement intégral automatique, sans frais et sans validation manuelle.**
 * L'agence a décidé d'annuler ; faire attendre une approbation laisserait des
 * passagers payer pour un car qui ne partira pas.
 */
export function useCancelTrip() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      reference,
      reason,
      note,
    }: {
      reference: string
      // Un motif **choisi**, pas saisi : le taux d'annulation se compte par
      // cause, et du texte libre ne se compte pas.
      reason: 'BREAKDOWN' | 'INSUFFICIENT_PASSENGERS' | 'ROAD_CLOSED' | 'OTHER'
      note?: string
    }) =>
      unwrap(
        await api.POST('/v1/agency/trips/{reference}/cancel', {
          params: { path: { reference } },
          body: { reason, ...(note === undefined || note === '' ? {} : { note }) },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.trips }),
  })
}
