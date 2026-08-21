import { useState } from 'react'
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
  SkeletonText,
  SkeletonTable,
  Table,
} from '../../shared/ui'
import {
  useCityRequests,
  useModerateStation,
  useResolveCityRequest,
  useStations,
} from './useAdmin'

type Station = {
  id: number
  name: string
  city?: string | null
  city_id?: number | null
  address?: string | null
  is_active?: boolean
  moderated_at?: string | null
}

type CityRequest = {
  id: number
  name?: string
  requested_name?: string
  agency?: string | null
  status?: string
  created_at?: string | null
}

/**
 * Le référentiel, et qui a le droit d'y ajouter.
 *
 * Les agences créent leurs propres gares et demandent des villes absentes. Sans
 * relecture, le référentiel se remplit de doublons — trois « Gare routière » dans
 * la même ville, deux orthographes de Bafoussam — et c'est la **recherche** qui
 * en pâtit : un passager qui cherche un départ ne trouve pas celui qui existe.
 *
 * Les deux files sont sur la même page parce qu'elles relèvent du même geste et
 * du même moment : on tient le référentiel propre, ou on ne le tient pas.
 */
export function ModerationPage() {
  return (
    <div>
      <PageHeader
        title="Référentiel"
        subtitle="Gares créées par les agences, et villes qu’elles réclament. Sans relecture, la recherche se dégrade."
      />

      <div className="flex flex-col gap-8">
        <CityRequests />
        <Stations />
      </div>
    </div>
  )
}

/**
 * Les demandes de ville.
 *
 * **Approuver exige de désigner la ville du référentiel** qui répond à la
 * demande. L'agence a écrit un nom libre ; le rattacher est ce qui évite de
 * créer une seconde Douala à côté de la première.
 */
function CityRequests() {
  const requests = useCityRequests()
  const resolve = useResolveCityRequest()
  const [cityId, setCityId] = useState<Record<number, string>>({})

  const rows = (
    (requests.data as { data?: CityRequest[] } | undefined)?.data ?? []
  ).filter((row) => row.status === undefined || row.status === 'PENDING')

  return (
    <Card>
      <h2 className="mb-1 text-lg font-bold text-ink-700">Villes demandées</h2>
      <p className="mb-4 text-sm text-neutral-500">
        Une agence ne peut pas créer de ville elle-même. Sans réponse ici, elle ne peut
        pas ouvrir la ligne qu’elle voulait vendre.
      </p>

      {requests.isPending ? <SkeletonText lines={3} /> : null}
      {requests.error ? <ErrorNote message={describeError(requests.error)} /> : null}
      {resolve.error ? <ErrorNote message={describeError(resolve.error)} /> : null}

      {requests.isSuccess && rows.length === 0 ? (
        <EmptyState title="Aucune demande en attente" />
      ) : null}

      {rows.map((row) => (
        <div key={row.id} className="border-t border-neutral-200 py-3">
          <p className="font-bold text-ink-700">
            {row.requested_name ?? row.name ?? '—'}
          </p>
          {row.agency ? (
            <p className="text-xs text-neutral-500">Demandée par {row.agency}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="w-52">
              <Field
                label="Identifiant de la ville à rattacher"
                hint="Nécessaire pour approuver — c’est ce qui évite un doublon."
              >
                <input
                  className={INPUT}
                  inputMode="numeric"
                  value={cityId[row.id] ?? ''}
                  onChange={(event) =>
                    setCityId((current) => ({ ...current, [row.id]: event.target.value }))
                  }
                />
              </Field>
            </div>

            <Button
              label="Approuver"
              disabled={
                !Number.isInteger(Number.parseInt(cityId[row.id] ?? '', 10)) ||
                resolve.isPending
              }
              onPress={() =>
                resolve.mutate({
                  id: row.id,
                  decision: 'APPROVE',
                  cityId: Number.parseInt(cityId[row.id] ?? '', 10),
                })
              }
            />
            <Button
              label="Rejeter"
              variant="secondary"
              disabled={resolve.isPending}
              onPress={() => resolve.mutate({ id: row.id, decision: 'REJECT' })}
            />
          </div>
        </div>
      ))}
    </Card>
  )
}

/**
 * Les gares créées par les agences.
 *
 * **Désactiver n'efface pas.** Une gare porte des départs passés et des billets
 * déjà validés ; la supprimer emporterait leur historique. On la retire donc de
 * la recherche en la laissant en place, ce que l'API appelle `DEACTIVATE`.
 */
function Stations() {
  const stations = useStations()
  const moderate = useModerateStation()

  const rows = (stations.data as { data?: Station[] } | undefined)?.data ?? []

  return (
    <Card>
      <h2 className="mb-1 text-lg font-bold text-ink-700">Gares</h2>
      <p className="mb-4 text-sm text-neutral-500">
        Désactiver retire la gare de la recherche sans toucher aux départs ni aux billets
        déjà émis.
      </p>

      {stations.isPending ? <SkeletonTable columns={4} rows={3} /> : null}
      {stations.error ? <ErrorNote message={describeError(stations.error)} /> : null}
      {moderate.error ? <ErrorNote message={describeError(moderate.error)} /> : null}

      {stations.isSuccess && rows.length === 0 ? (
        <EmptyState title="Aucune gare à relire" />
      ) : null}

      {rows.length > 0 ? (
        <Table head={['Gare', 'Ville', 'État', '']}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-neutral-200">
              <Cell>
                <span className="font-bold text-ink-700">{row.name}</span>
                {row.address ? (
                  <span className="block text-xs text-neutral-500">{row.address}</span>
                ) : null}
              </Cell>
              <Cell>{row.city ?? '—'}</Cell>
              <Cell>
                {row.is_active === false ? 'Désactivée' : 'Active'}
                <span className="block text-xs text-neutral-500">
                  {row.moderated_at === null || row.moderated_at === undefined
                    ? 'Jamais relue'
                    : 'Relue'}
                </span>
              </Cell>
              <Cell>
                {row.is_active === false ? (
                  <Button
                    label="Réactiver"
                    variant="secondary"
                    disabled={moderate.isPending}
                    onPress={() => moderate.mutate({ id: row.id, decision: 'KEEP' })}
                  />
                ) : (
                  <div className="flex gap-2">
                    <Button
                      label="Conserver"
                      variant="secondary"
                      disabled={moderate.isPending}
                      onPress={() => moderate.mutate({ id: row.id, decision: 'KEEP' })}
                    />
                    <Button
                      label="Désactiver"
                      variant="danger"
                      disabled={moderate.isPending}
                      onPress={() =>
                        moderate.mutate({ id: row.id, decision: 'DEACTIVATE' })
                      }
                    />
                  </div>
                )}
              </Cell>
            </tr>
          ))}
        </Table>
      ) : null}
    </Card>
  )
}
