import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { unwrap } from '@motoboy/api-client'
import { api } from '../../lib/api'
import { describeError } from '../../lib/errors'
import {
  Button,
  Card,
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  Skeleton,
  Table,
} from '../../shared/ui'

/** Ce que la plateforme attend d'une agence, et les libellés qui le disent. */
const TYPES = [
  ['REGISTRATION', 'Registre de commerce'],
  ['TRANSPORT_LICENCE', 'Licence de transport'],
  ['INSURANCE', 'Assurance'],
  ['ID_DOCUMENT', 'Pièce d’identité du dirigeant'],
  ['OTHER', 'Autre'],
] as const

/** Huit mégaoctets, comme la validation côté serveur. */
const MAX_BYTES = 8192 * 1024

type Document = {
  id?: number
  type?: string
  status?: string
  expires_at?: string | null
  file_path?: string | null
  created_at?: string | null
}

function useDocuments() {
  return useQuery({
    queryKey: ['agency-documents'],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/agency/documents', { signal })),
  })
}

/**
 * Le dépôt d'une pièce.
 *
 * **Premier envoi de fichier du web, d'où le sérialiseur explicite.** Le client
 * typé encode en JSON par défaut ; laisser faire enverrait `[object File]`. On
 * rend donc le `FormData` tel quel — et **sans fixer `Content-Type`** : le
 * navigateur doit y écrire lui-même la frontière multipart, qu'il est seul à
 * connaître. La renseigner à la main produit un corps que le serveur ne sait pas
 * découper, et l'erreur parle alors d'un champ manquant plutôt que de l'en-tête.
 */
function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      type,
      file,
      expiresAt,
    }: {
      type: string
      file: File
      expiresAt: string
    }) => {
      const form = new FormData()
      form.append('type', type)
      form.append('file', file)

      if (expiresAt !== '') {
        form.append('expires_at', expiresAt)
      }

      return unwrap(
        await api.POST('/v1/agency/documents', {
          body: form as never,
          bodySerializer: (body: unknown) => body as FormData,
        }),
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agency-documents'] }),
  })
}

/**
 * Les pièces de l'agence.
 *
 * **C'est ce que l'administration relit pour admettre l'agence.** Sans écran pour
 * les déposer, une agence pouvait s'inscrire et rester indéfiniment en attente
 * sans jamais comprendre ce qui lui manquait — l'API acceptait les fichiers,
 * personne ne pouvait les envoyer.
 *
 * La liste énumère donc les types attendus **y compris ceux qui manquent** : trois
 * pièces déposées ne se lisent pas comme un dossier incomplet tant qu'on ignore
 * combien il en faut.
 */
export function DocumentsPage() {
  const documents = useDocuments()
  const upload = useUploadDocument()

  const [type, setType] = useState<string>('REGISTRATION')
  const [file, setFile] = useState<File | null>(null)
  const [expiresAt, setExpiresAt] = useState('')

  const rows = ((documents.data as { data?: Document[] } | undefined)?.data ??
    []) as Document[]
  const tooLarge = file !== null && file.size > MAX_BYTES

  return (
    <div>
      <PageHeader
        title="Pièces de l’agence"
        subtitle="C’est sur ces pièces que la plateforme instruit votre dossier. Tant qu’elles manquent, l’admission ne peut pas avancer."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-3 text-lg font-bold text-ink-700">Déposer une pièce</h2>

          {upload.error ? <ErrorNote message={describeError(upload.error)} /> : null}

          <div className="flex flex-col gap-3">
            <Field label="Nature de la pièce">
              <select
                className={INPUT}
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Fichier" hint="PDF ou image, 8 Mo au maximum.">
              <input
                className={INPUT}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Field>

            {/*
              La taille est vérifiée ici **avant** l'envoi. Huit mégaoctets sur une
              connexion de gare mettent une minute à monter pour être refusés à
              l'arrivée : autant le dire tout de suite.
            */}
            {tooLarge ? (
              <p className="text-xs text-danger">
                Ce fichier dépasse 8 Mo. Il serait refusé après l’envoi.
              </p>
            ) : null}

            <Field
              label="Date d’expiration"
              hint="Facultative. Une assurance ou une licence en a une ; un registre de commerce, non."
            >
              <input
                className={INPUT}
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </Field>

            <div>
              <Button
                label="Déposer"
                disabled={file === null || tooLarge || upload.isPending}
                onPress={() => {
                  if (file === null) return

                  upload.mutate(
                    { type, file, expiresAt },
                    {
                      onSuccess: () => {
                        setFile(null)
                        setExpiresAt('')
                      },
                    },
                  )
                }}
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold text-ink-700">Pièces déposées</h2>

          {documents.isPending ? <Skeleton rows={3} /> : null}
          {documents.error ? (
            <ErrorNote message={describeError(documents.error)} />
          ) : null}

          {documents.isSuccess && rows.length === 0 ? (
            <EmptyState
              title="Aucune pièce déposée"
              body="Commencez par le registre de commerce : c’est celui que la plateforme regarde en premier."
            />
          ) : null}

          {rows.length > 0 ? (
            <Table head={['Pièce', 'État', 'Expiration']}>
              {TYPES.map(([value, label]) => {
                const found = rows.find((row) => row.type === value)

                if (found === undefined && value === 'OTHER') return null

                return (
                  <tr key={value} className="border-t border-neutral-200">
                    <Cell>{label}</Cell>
                    <Cell>
                      {found === undefined ? (
                        // Nommer l'absence : une ligne manquante se lit comme un
                        // oubli d'affichage, pas comme une pièce à fournir.
                        <span className="text-neutral-500">Non déposée</span>
                      ) : (
                        (found.status ?? '—')
                      )}
                    </Cell>
                    <Cell>{found?.expires_at ?? '—'}</Cell>
                  </tr>
                )
              })}
            </Table>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
