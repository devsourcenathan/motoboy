import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unwrap } from '@motoboy/api-client'
import type {
  AgencyDriver,
  AgencyDriverInput,
  AgencyRoute,
  AgencyRouteInput,
  AgencyScheduleInput,
  AgencyStation,
  AgencyStationInput,
  AgencyVehicle,
  AgencyVehicleInput,
} from '@motoboy/api-client/types'
import { api } from '../../lib/api'

export type { AgencyDriver, AgencyRoute, AgencyStation, AgencyVehicle }

/**
 * L'inventaire d'une agence.
 *
 * **C'est ce qui rend la plateforme cherchable.** Sans gares, véhicules,
 * itinéraires et horaires, aucun départ n'existe et un passager qui cherche ne
 * trouve rien — tout le reste du produit repose sur ces quatre écrans.
 *
 * Les clés de cache sont préfixées par `agency` : un même navigateur peut porter
 * une session d'administration et une session d'agence à quelques minutes
 * d'intervalle, et deux listes homonymes se mélangeraient.
 */
const keys = {
  stations: ['agency', 'stations'] as const,
  vehicles: ['agency', 'vehicles'] as const,
  seats: (id: number) => ['agency', 'vehicles', id, 'seats'] as const,
  drivers: ['agency', 'drivers'] as const,
  routes: ['agency', 'routes'] as const,
}

export function useStations() {
  return useQuery({
    queryKey: keys.stations,
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/agency/stations', { signal })),
  })
}

export function useCreateStation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: AgencyStationInput) =>
      unwrap(await api.POST('/v1/agency/stations', { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.stations }),
  })
}

export function useVehicles() {
  return useQuery({
    queryKey: keys.vehicles,
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/agency/vehicles', { signal })),
  })
}

export function useCreateVehicle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: AgencyVehicleInput) =>
      unwrap(await api.POST('/v1/agency/vehicles', { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.vehicles }),
  })
}

/**
 * Le plan de sièges d'un véhicule.
 *
 * Chargé **à la demande** : un parc de trente véhicules ferait trente requêtes
 * pour un plan que personne ne regarde tant qu'il n'a pas cliqué.
 */
export function useVehicleSeats(vehicleId: number | null) {
  return useQuery({
    queryKey: keys.seats(vehicleId ?? 0),
    enabled: vehicleId !== null,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/agency/vehicles/{id}/seats', {
          params: { path: { id: vehicleId ?? 0 } },
          signal,
        }),
      ),
  })
}

export function useDrivers() {
  return useQuery({
    queryKey: keys.drivers,
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/agency/drivers', { signal })),
  })
}

export function useCreateDriver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: AgencyDriverInput) =>
      unwrap(await api.POST('/v1/agency/drivers', { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.drivers }),
  })
}

export function useRoutes() {
  return useQuery({
    queryKey: keys.routes,
    queryFn: async ({ signal }) => unwrap(await api.GET('/v1/agency/routes', { signal })),
  })
}

export function useCreateRoute() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: AgencyRouteInput) =>
      unwrap(await api.POST('/v1/agency/routes', { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.routes }),
  })
}

/**
 * Un horaire sur un itinéraire.
 *
 * L'horaire est un **modèle**, pas un départ : il décrit « tous les lundis à
 * 7 h », et la génération en tire les départs réels. Les confondre ferait
 * ressaisir la même ligne chaque semaine.
 */
export function useCreateSchedule(routeId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: AgencyScheduleInput) =>
      unwrap(
        await api.POST('/v1/agency/routes/{routeId}/schedules', {
          params: { path: { routeId } },
          body,
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.routes }),
  })
}

/**
 * Génère les départs à partir des horaires.
 *
 * **Le geste qui rend l'inventaire visible** : jusqu'à cet appel, les horaires
 * ne sont que des intentions, et la recherche ne renvoie rien.
 */
export function useGenerateTrips() {
  const queryClient = useQueryClient()

  return useMutation({
    /*
     * **Aucun paramètre** : le serveur génère sur son horizon glissant et ne
     * touche jamais à un départ existant. Laisser le client choisir une fenêtre
     * inviterait à régénérer par-dessus des départs portant déjà des
     * réservations.
     */
    mutationFn: async () => unwrap(await api.POST('/v1/agency/trips/generate', {})),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['agency'] }),
  })
}
