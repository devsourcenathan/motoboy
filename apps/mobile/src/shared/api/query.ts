import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@motoboy/api-client'

/** Nombre de tentatives sur un échec **transitoire**, la première comprise. */
const TRANSIENT_ATTEMPTS = 3

/**
 * Une minute.
 *
 * La disponibilité des places bouge vite : afficher « complet » sur un départ
 * qui ne l'est plus fait renoncer un passager qui aurait pu réserver.
 */
const STALE_TIME_MS = 60_000

/**
 * Une semaine.
 *
 * Le cache n'est pas là pour épargner des requêtes, mais pour que le billet
 * survive à un téléphone sans réseau plusieurs jours après l'achat (I5).
 */
const CACHE_LIFETIME_MS = 7 * 24 * 60 * 60_000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /*
       * Ne pas réessayer une erreur métier.
       *
       * Un siège déjà pris, un délai d'annulation dépassé, une session
       * expirée : réessayer ne changera rien et retarderait l'affichage du
       * message qui, lui, aide. Seuls les échecs transitoires — réseau, 5xx,
       * limitation de débit — méritent une seconde tentative.
       */
      retry: (attempt, error) => {
        if (error instanceof ApiError && !error.isTransient) return false

        return attempt < TRANSIENT_ATTEMPTS - 1
      },
      staleTime: STALE_TIME_MS,
      gcTime: CACHE_LIFETIME_MS,
    },
  },
})

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'motoboy.query-cache',
})
