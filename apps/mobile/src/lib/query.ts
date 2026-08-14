import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@motoboy/api-client'

/**
 * Le cache des requêtes, **persisté sur le disque**.
 *
 * C'est ce qui rend le billet consultable sans réseau : le produit s'utilise en
 * gare routière, où la couverture n'est pas garantie, et un billet qui ne
 * s'affiche pas en gare ne vaut rien (I5 du brief).
 */
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

        return attempt < 2
      },

      // Une minute : la disponibilité des places bouge vite, et afficher un
      // départ « complet » qui ne l'est plus fait renoncer un passager qui
      // aurait pu réserver.
      staleTime: 60_000,

      // Une semaine. Le cache n'est pas là pour épargner des requêtes mais pour
      // que le billet survive à un téléphone sans réseau, plusieurs jours après
      // l'achat.
      gcTime: 7 * 24 * 60 * 60_000,
    },
  },
})

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'motoboy.query-cache',
})

/**
 * ⚠️ **Ce qui ne doit jamais être persisté.**
 *
 * Le cache est écrit en clair : y laisser une réponse contenant des données
 * d'un autre utilisateur, ou le profil d'un compte déconnecté, les rendrait
 * lisibles après coup. Les billets et les départs, eux, n'ont rien de secret —
 * et ce sont précisément ceux qu'il faut garder hors ligne.
 */
export function shouldPersist(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0]

  return root === 'tickets' || root === 'bookings' || root === 'trip'
}
