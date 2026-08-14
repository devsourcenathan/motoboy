import { useQuery } from '@tanstack/react-query'
import { unwrap, type Ticket } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'

/**
 * Un billet ne change pratiquement jamais.
 *
 * Émis, il ne bouge qu'à l'annulation ou à l'embarquement. Le rafraîchir sans
 * cesse coûterait du réseau là où il y en a le moins — en gare — pour une
 * réponse identique. Une heure suffit ; le tirer pour rafraîchir reste possible.
 */
const TICKET_STALE_MS = 60 * 60_000

export function useTickets() {
  return useQuery({
    queryKey: queryKeys.tickets(),
    staleTime: TICKET_STALE_MS,
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/tickets', { signal })

      return unwrap(response).data as Ticket[]
    },
  })
}

/**
 * Le billet, consultable **sans réseau**.
 *
 * Le cache est persisté sur le disque : c'est ce qui fait qu'un billet acheté
 * la veille s'ouvre en gare, où la couverture n'est pas garantie. Le QR est
 * regénéré depuis `qr_payload`, jamais téléchargé comme image — un billet dont
 * le code ne s'affiche pas ne vaut rien (I5).
 */
export function useTicket(reference: string) {
  return useQuery({
    queryKey: queryKeys.ticket(reference),
    staleTime: TICKET_STALE_MS,
    // Le billet en cache s'affiche immédiatement, même hors ligne : attendre le
    // réseau pour montrer ce qu'on a déjà ferait échouer l'écran au seul moment
    // où il compte.
    networkMode: 'offlineFirst',
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/tickets/{reference}', {
        params: { path: { reference } },
        signal,
      })

      return unwrap(response) as Ticket
    },
  })
}
