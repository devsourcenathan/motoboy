import { useMutation, useQueryClient } from '@tanstack/react-query'
import { File } from 'expo-file-system'
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
       * ⚠️ **Le fichier doit porter son nom, et lui seul le porte.**
       *
       * Trois formes ont été essayées avant celle-ci, et les deux premières
       * échouaient sur l'appareil :
       *
       * 1. Le triplet `{uri, name, type}` — la forme historique de React Native.
       *    Expo SDK 57 sérialise le corps lui-même et ne la connaît pas :
       *    « Unsupported FormDataPart implementation ».
       * 2. Un `Blob` avec le nom en troisième argument d'`append`. Le `FormData`
       *    de React Native n'accepte que **deux** paramètres — le nom était donc
       *    jeté en silence, la partie partait sans `filename=`, et Laravel voit
       *    alors un champ texte et non un fichier. D'où le 422 « file must be a
       *    file », vérifié en rejouant la requête à la main sans `filename`.
       * 3. `File` d'`expo-file-system`, qui **implémente `Blob` et porte un
       *    `name`** : le nom voyage avec l'objet, sans dépendre de la signature
       *    d'`append`.
       *
       * Elle évite au passage le passage en base64 que `Response.blob()`
       * imposait — l'avertissement que l'appareil affichait.
       */
      body.append('file', new File(upload.file.uri))

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
