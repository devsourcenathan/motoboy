import { useQuery } from '@tanstack/react-query'
import { unwrap } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'

/**
 * Ce que la plateforme demande comme pièce d'identité, aujourd'hui.
 *
 * **Le serveur décide, l'écran obéit.** Deviner ferait afficher un champ que le
 * serveur refuse, ou taire celui qu'il exige — et le passager perdrait sa place
 * pendant qu'il comprend.
 *
 * Mis en cache longuement : un réglage de plateforme change une fois par an, et
 * le relire à chaque ouverture du formulaire coûterait un aller-retour sur une
 * connexion qui n'en a pas de trop.
 */
export function useIdDocumentPolicy() {
  return useQuery({
    queryKey: ['config', 'id-documents'],
    staleTime: 60 * 60 * 1000,
    queryFn: async ({ signal }) => unwrap(await api.GET('/v1/config', { signal })),
  })
}
