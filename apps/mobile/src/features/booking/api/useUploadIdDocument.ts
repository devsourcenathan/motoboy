import { useMutation } from '@tanstack/react-query'
import { File } from 'expo-file-system'
import { toApiError } from '@motoboy/api-client'
import { API_BASE_URL } from '../../../shared/api/client'
import { session } from '../../../shared/session/session'

/**
 * Dépose la photo de la pièce, et rend son chemin.
 *
 * **Hors du client généré**, comme les pièces du chauffeur : `openapi-fetch`
 * sérialise en JSON, et un fichier doit passer en `multipart/form-data`.
 *
 * `File` d'`expo-file-system` plutôt qu'un `Blob` : il implémente `Blob` **et**
 * porte un nom. `FormData.append` de React Native ne prend que deux paramètres,
 * donc un nom passé en troisième argument est jeté en silence — la partie part
 * alors sans `filename=`, et le serveur voit un champ texte au lieu d'un fichier.
 */
export function useUploadIdDocument() {
  return useMutation({
    mutationFn: async (uri: string): Promise<string> => {
      const body = new FormData()

      body.append('file', new File(uri))

      const token = await session.token()

      const response = await fetch(`${API_BASE_URL}/v1/id-documents`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          // Pas de `Content-Type` : c'est `fetch` qui l'écrit, avec la frontière
          // qu'il vient de tirer.
          ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
        },
        body,
      })

      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status === 401) session.expire()

        throw toApiError(payload, response.status)
      }

      const path = (payload as { path?: unknown } | null)?.path

      if (typeof path !== 'string') {
        throw new Error('Dépôt accepté sans chemin de retour.')
      }

      return path
    },
  })
}
