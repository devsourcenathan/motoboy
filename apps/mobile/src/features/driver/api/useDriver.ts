import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, unwrap } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys, QUERY_ROOT } from '../../../shared/api/queryKeys'
import type { DriverApplication } from '../model/driverApplication'

async function fetchDriverProfile() {
  const response = await api.GET('/v1/driver')

  return unwrap(response)
}

export type DriverProfile = Awaited<ReturnType<typeof fetchDriverProfile>>

/**
 * Son dossier, ou l'absence de dossier.
 *
 * **Le 404 est une réponse, pas une panne.** Un passager qui n'a jamais postulé
 * n'a pas de dossier : l'API le dit par `NOT_FOUND`, et le traiter comme une
 * erreur montrerait un écran d'échec à quelqu'un dont tout va bien. La requête
 * renvoie donc `null`, et l'écran distingue « pas encore chauffeur » de « le
 * serveur ne répond pas ».
 */
export function useDriverProfile() {
  return useQuery({
    queryKey: queryKeys.driverProfile(),
    queryFn: async (): Promise<DriverProfile | null> => {
      try {
        return await fetchDriverProfile()
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null

        throw error
      }
    },
    // Inutile de réessayer une absence de dossier : elle ne changera pas d'avis.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  })
}

/**
 * Dépose ou représente son dossier.
 *
 * Rejouable côté serveur : un dossier refusé se corrige et repart en examen.
 * L'écran s'appuie là-dessus plutôt que de distinguer création et mise à jour.
 */
export function useSubmitApplication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (form: DriverApplication) => {
      const response = await api.POST('/v1/driver', {
        body: {
          license_number: form.licenceNumber.trim(),
          license_expires_at: form.licenceExpiresAt,
          vehicle_plate: form.plate.trim().toUpperCase(),
          vehicle_type: form.vehicleType,
          vehicle_model: form.model.trim() === '' ? null : form.model.trim(),
          vehicle_seats: form.seats,
          city_id: form.city!.cityId,
        },
      })

      return unwrap(response)
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.driverProfile(), profile)
    },
  })
}

/**
 * Invalide tout ce qui dépend du chauffeur.
 *
 * Une offre acceptée devient une course, une course terminée libère le chauffeur
 * pour la suivante : ces listes bougent ensemble. Les énumérer à chaque mutation
 * ferait oublier la troisième le jour où elle est ajoutée.
 */
function invalidateDriver(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [QUERY_ROOT.driver] })
}

export { invalidateDriver }
