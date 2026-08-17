import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { newIdempotencyKey, unwrap, type Payment } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'
import type { ServiceCallForm } from '../model/serviceCallForm'

/**
 * Cadence de rafraîchissement pendant l'attente.
 *
 * Une offre arrive quand un chauffeur la dépose, sans que le téléphone en soit
 * averti : faute de canal temps réel, l'écran redemande. Dix secondes tiennent
 * l'attente vivante sans transformer une demande de trente minutes en cent
 * quatre-vingts requêtes.
 */
const POLL_INTERVAL_MS = 10_000

/**
 * Ouvre un appel de service.
 *
 * Aucune clé d'idempotence : contrairement à une réservation, une demande ne
 * tient aucune place et n'engage aucun argent. Deux envois accidentels donnent
 * deux demandes, que le passager peut annuler — moins grave qu'un siège bloqué
 * ou un paiement joué deux fois.
 */
export function useOpenServiceCall() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (form: ServiceCallForm) => {
      const response = await api.POST('/v1/service-requests', {
        body: {
          origin_city_id: form.from!.cityId,
          origin_landmark: form.fromLandmark.trim(),
          destination_city_id: form.to!.cityId,
          destination_landmark:
            form.toLandmark.trim() === '' ? null : form.toLandmark.trim(),
          passengers: form.travellers,
          note: form.note.trim() === '' ? null : form.note.trim(),
        },
      })

      return unwrap(response)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests() })
    },
  })
}

async function fetchServiceCall(reference: string) {
  const response = await api.GET('/v1/service-requests/{reference}', {
    params: { path: { reference } },
  })

  return unwrap(response)
}

/** La forme que le serveur promet, plutôt qu'une copie qu'il faudrait tenir à jour. */
export type ServiceCallDetail = Awaited<ReturnType<typeof fetchServiceCall>>

/**
 * Suit une demande et ses offres.
 *
 * Le sondage s'arrête de lui-même dès que plus rien ne peut arriver — demande
 * expirée, annulée, ou course terminée. Une demande conclue continuerait sinon à
 * interroger le serveur indéfiniment, batterie et forfait compris, pour une
 * réponse qui ne changera plus.
 */
export function useServiceCall(reference: string) {
  return useQuery({
    queryKey: queryKeys.serviceRequest(reference),
    queryFn: () => fetchServiceCall(reference),
    enabled: reference !== '',
    refetchInterval: (query) => (isSettled(query.state.data) ? false : POLL_INTERVAL_MS),
  })
}

/**
 * Vrai quand l'attente n'a plus d'objet.
 *
 * Une course payée mais pas encore faite reste vivante : son état passe à
 * `IN_PROGRESS` puis `COMPLETED` du côté du chauffeur, et le passager doit le
 * voir arriver.
 */
function isSettled(data: ServiceCallDetail | undefined): boolean {
  if (data === undefined) return false
  if (data.status === 'EXPIRED' || data.status === 'CANCELLED') return true

  return data.ride?.status === 'COMPLETED' || data.ride?.status === 'CANCELLED'
}

/**
 * Retient une offre.
 *
 * L'échec attendu est le 409 : un autre passager n'entre pas en jeu, mais le
 * chauffeur peut avoir pris une course entre-temps, et la base tranche. Le
 * message d'erreur suffit — l'écran se rafraîchit avec les offres restantes.
 */
export function useAcceptOffer(reference: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (offer: number) => {
      const response = await api.POST('/v1/offers/{offer}/accept', {
        params: { path: { offer } },
      })

      return unwrap(response)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequest(reference) })
    },
  })
}

/** Annule la demande, et avec elle une course éventuellement déjà conclue. */
export function useCancelServiceCall(reference: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await api.POST('/v1/service-requests/{reference}/cancel', {
        params: { path: { reference } },
        body: {},
      })

      return unwrap(response)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.serviceRequest(reference), data)
    },
  })
}

/**
 * Paie la course retenue.
 *
 * ⚠️ **Une clé neuve à chaque tentative**, comme pour une réservation : une
 * course porte plusieurs tentatives dont une seule aboutit, et rejouer la clé
 * après un code erroné renverrait le refus précédent au passager qui vient de
 * saisir le bon.
 */
export function usePayForRide(serviceRequestReference: string, rideReference: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (operator: string) => {
      const response = await api.POST('/v1/rides/{reference}/payments', {
        params: {
          path: { reference: rideReference },
          header: { 'Idempotency-Key': newIdempotencyKey() },
        },
        body: { method: 'MOBILE_MONEY', operator },
      })

      return unwrap(response) as Payment
    },
    /*
     * Rien à mettre à jour ici : le paiement revient `PENDING`, et c'est le
     * sondage de la demande qui verra `paid` basculer une fois le webhook passé.
     * Écrire l'état soi-même donnerait une confirmation que la plateforme n'a pas
     * encore reçue.
     */
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.serviceRequest(serviceRequestReference),
      })
    },
  })
}

/** Signale que le chauffeur ne s'est pas présenté : remboursement intégral. */
export function useReportNoShow(serviceRequestReference: string, rideReference: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await api.POST('/v1/rides/{reference}/no-show', {
        params: { path: { reference: rideReference } },
      })

      return unwrap(response)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.serviceRequest(serviceRequestReference),
      })
    },
  })
}
