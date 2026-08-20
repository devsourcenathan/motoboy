import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
/**
 * Ce que la plateforme attend d'une agence.
 *
 * Une **clé** et non un libellé : écrit ici, le texte serait épinglé à la langue
 * de ce fichier, et l'écran resterait en français une fois tout le reste traduit.
 */
const TYPES = [
  ['REGISTRATION', 'registration'],
  ['TRANSPORT_LICENCE', 'transportLicence'],
  ['INSURANCE', 'insurance'],
  ['ID_DOCUMENT', 'idDocument'],
  ['OTHER', 'other'],
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
 * Le dépôt d'une pièce — premier envoi de fichier du web.
 *
 * **Aucun sérialiseur explicite, et c'est vérifié.** J'en avais écrit un, en
 * expliquant que le client typé encoderait sinon en JSON et enverrait
 * `[object File]`. Le test l'a démenti : la requête part en `multipart/form-data`
 * avec sa frontière, sérialiseur ou pas — `openapi-fetch` reconnaît un `FormData`
 * et le laisse passer. Le retirer supprime du code mort et un commentaire faux.
 *
 * **`Content-Type` n'est jamais fixé à la main.** Le navigateur seul connaît la
 * frontière multipart ; la renseigner soi-même produit un corps que le serveur ne
 * sait pas découper, et l'erreur parle alors d'un champ manquant plutôt que d'un
 * en-tête.
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

      return unwrap(await api.POST('/v1/agency/documents', { body: form as never }))
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
  const { t } = useTranslation()
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
        title={t('agency:documents.title')}
        subtitle={t('agency:documents.subtitle')}
      />

      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-3 text-lg font-bold text-ink-700">
            {t('agency:documents.upload')}
          </h2>

          {upload.error ? <ErrorNote message={describeError(upload.error)} /> : null}

          <div className="flex flex-col gap-3">
            <Field label={t('agency:documents.kind')}>
              <select
                className={INPUT}
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {TYPES.map(([value, key]) => (
                  <option key={value} value={value}>
                    {t(`agency:documents.types.${key}`)}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={t('agency:documents.file')}
              hint={t('agency:documents.fileHint')}
            >
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
              label={t('agency:documents.expiry')}
              hint={t('agency:documents.expiryHint')}
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
                label={t('agency:documents.submit')}
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
          <h2 className="mb-3 text-lg font-bold text-ink-700">
            {t('agency:documents.filed')}
          </h2>

          {documents.isPending ? <Skeleton rows={3} /> : null}
          {documents.error ? (
            <ErrorNote message={describeError(documents.error)} />
          ) : null}

          {documents.isSuccess && rows.length === 0 ? (
            <EmptyState
              title={t('agency:documents.emptyTitle')}
              body={t('agency:documents.emptyBody')}
            />
          ) : null}

          {rows.length > 0 ? (
            <Table
              head={[
                t('agency:documents.head.document'),
                t('agency:documents.head.status'),
                t('agency:documents.head.expiry'),
              ]}
            >
              {TYPES.map(([value, key]) => {
                const found = rows.find((row) => row.type === value)

                if (found === undefined && value === 'OTHER') return null

                return (
                  <tr key={value} className="border-t border-neutral-200">
                    <Cell>{t(`agency:documents.types.${key}`)}</Cell>
                    <Cell>
                      {found === undefined ? (
                        // Nommer l'absence : une ligne manquante se lit comme un
                        // oubli d'affichage, pas comme une pièce à fournir.
                        <span className="text-neutral-500">
                          {t('agency:documents.notFiled')}
                        </span>
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
