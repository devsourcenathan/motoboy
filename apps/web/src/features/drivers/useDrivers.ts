import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unwrap } from '@motoboy/api-client'
import type { AdminDriverRow, DriverStatus } from '@motoboy/api-client/types'
import { api } from '../../lib/api'
import { queryKeys } from '../../lib/queryKeys'

export type { AdminDriverRow }

export function useDriverQueue(status: DriverStatus) {
  return useQuery({
    queryKey: queryKeys.drivers(status),
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/admin/drivers', {
        params: { query: { status } },
        signal,
      })

      return unwrap(response)
    },
  })
}

/**
 * Valider, refuser, suspendre.
 *
 * Les trois passent par le même hook : ce sont trois issues d'un même geste —
 * instruire un dossier — et les séparer dupliquerait l'invalidation, qu'on
 * finirait par oublier sur la troisième.
 *
 * **Toutes les files sont invalidées, pas seulement celle affichée.** Une
 * décision déplace le dossier d'une file vers une autre : n'invalider que la
 * courante laisserait la file d'arrivée périmée, et l'administrateur qui y passe
 * ne verrait pas ce qu'il vient de décider.
 */
export function useDecideDriver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      decision,
      reason,
    }: {
      id: number
      decision: 'approve' | 'reject' | 'suspend'
      reason?: string
    }) => {
      /*
       * Les trois chemins ne partagent pas la même signature — approuver n'a pas
       * de corps, refuser et suspendre en ont un. Un appel générique demanderait
       * de mentir au typage sur les deux ; trois appels explicites laissent le
       * contrat vérifier chacun.
       *
       * Le motif n'accompagne donc que le refus et la suspension : approuver n'a
       * rien à justifier, et le champ resterait vide dans le journal d'audit.
       */
      const path = { path: { driver: id } }

      if (decision === 'approve') {
        return unwrap(await api.POST('/v1/admin/drivers/{driver}/approve', { params: path }))
      }

      if (decision === 'reject') {
        return unwrap(
          await api.POST('/v1/admin/drivers/{driver}/reject', {
            params: path,
            body: { note: reason ?? '' },
          }),
        )
      }

      return unwrap(
        await api.POST('/v1/admin/drivers/{driver}/suspend', {
          params: path,
          body: { note: reason ?? '' },
        }),
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drivers'] })
    },
  })
}
