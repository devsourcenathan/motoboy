import { useMutation, useQueryClient } from '@tanstack/react-query'
import { unwrap } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'
import type { ServiceCallForm } from '../model/serviceCallForm'

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
