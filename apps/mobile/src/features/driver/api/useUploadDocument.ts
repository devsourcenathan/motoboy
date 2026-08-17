import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toApiError } from '@motoboy/api-client'
import { API_BASE_URL } from '../../../shared/api/client'
import { session } from '../../../shared/session/session'
import { queryKeys } from '../../../shared/api/queryKeys'
import type { DocumentType } from '../model/driverApplication'

export interface PickedFile {
  readonly uri: string
  readonly name: string
  readonly mimeType: string
}

/**
 * Dépose une pièce du dossier (C2).
 *
 * **Hors du client généré, à dessein.** `openapi-fetch` sérialise le corps en
 * JSON ; un fichier de React Native est un objet `{uri, name, type}` que seul
 * `fetch` sait transformer en partie multipart. Le faire passer par le client
 * enverrait la description du fichier au lieu du fichier.
 *
 * Le jeton et l'adresse viennent des mêmes sources que le reste : les
 * redemander à l'utilisateur ou coder l'adresse en dur créerait un deuxième
 * chemin d'authentification.
 */
export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (upload: { type: DocumentType; file: PickedFile }) => {
      const body = new FormData()

      body.append('type', upload.type)
      /*
       * Le triplet attendu par React Native. Le cast est nécessaire : la
       * signature DOM de `FormData.append` n'accepte que `string | Blob`, et le
       * polyfill de React Native accepte en plus cette forme.
       */
      body.append('file', {
        uri: upload.file.uri,
        name: upload.file.name,
        type: upload.file.mimeType,
      } as unknown as Blob)

      const token = await session.token()

      const response = await fetch(`${API_BASE_URL}/v1/driver/documents`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          /*
           * Pas de `Content-Type` : c'est `fetch` qui doit l'écrire, avec la
           * frontière qu'il vient de tirer au hasard. En le fixant soi-même on
           * envoie un en-tête sans frontière, et le serveur ne trouve aucune
           * partie dans un corps pourtant complet.
           */
          ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
        },
        body,
      })

      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status === 401) session.expire()

        throw toApiError(payload, response.status)
      }

      return payload
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverProfile() })
    },
  })
}
