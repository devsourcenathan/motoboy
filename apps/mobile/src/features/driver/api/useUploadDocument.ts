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
       * ⚠️ **Le fichier passe par un `Blob`, pas par le triplet.**
       *
       * `{uri, name, type}` est la forme historique de React Native, comprise
       * par son propre `fetch`. Expo SDK 57 installe une implémentation conforme
       * à WinterCG, qui ne la connaît pas : chaque dépôt levait « Unsupported
       * FormDataPart implementation », une erreur du module natif qui ne dit
       * rien de la cause.
       *
       * Lire l'URI en `Blob` fonctionne des deux côtés — c'est la forme que la
       * spécification impose, et celle que React Native accepte aussi. Le coût
       * est un passage du fichier en mémoire, acceptable pour une pièce
       * d'identité photographiée.
       */
      const file = await fetch(upload.file.uri)

      if (!file.ok) {
        throw new Error(`Fichier illisible : ${upload.file.uri}`)
      }

      body.append('file', await file.blob(), upload.file.name)

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
