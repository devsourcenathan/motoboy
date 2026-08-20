import { useMutation, useQuery } from '@tanstack/react-query'
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
  Panel,
  Skeleton,
  Table,
} from '../../shared/ui'
import { CityField, type CityChoice } from './CityField'
import { useCreateStation, useStations } from './useInventory'

/**
 * Reclamer une ville absente du referentiel.
 *
 * **Une agence ne peut pas creer de ville elle-meme**, sinon on aurait trois
 * orthographes de Bafoussam et une recherche qui ne trouve plus les departs qui
 * existent. Elle demande, l'administration rattache au referentiel.
 *
 * Le pays vient de `/v1/config` et non d'une constante : l'ecrire en dur
 * fonctionnerait tant qu'un seul pays est desservi, puis rattacherait
 * silencieusement les demandes au mauvais des le second.
 */
function RequestCity() {
  const config = useQuery({
    queryKey: ['config'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/v1/config', { signal })),
  })

  const countries = config.data?.countries ?? []

  const [name, setName] = useState('')
  const [countryId, setCountryId] = useState<number | null>(null)

  const request = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/agency/city-requests', {
          body: {
            country_id: countryId ?? countries[0]?.id ?? 0,
            requested_name: name.trim(),
          } as never,
        }),
      ),
    onSuccess: () => setName(''),
  })

  const selected = countryId ?? countries[0]?.id ?? null

  return (
    <Card>
      <p className="mb-1 font-semibold text-neutral-900">Demander une ville</p>
      <p className="mb-3 text-sm text-neutral-500">
        Si la ville que vous desservez n’apparaît pas, demandez-la. MOTOBOY la rattachera
        au référentiel — c’est ce qui évite deux Douala.
      </p>

      {request.error ? <ErrorNote message={describeError(request.error)} /> : null}

      {request.isSuccess ? (
        <p className="mb-3 text-sm text-success-700">
          Demande transmise. Elle apparaîtra dès qu’elle sera acceptée.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        {/*
          Le sélecteur ne s'affiche qu'au-delà d'un pays : en proposer un seul
          demanderait un choix qui n'en est pas un.
        */}
        {countries.length > 1 ? (
          <div className="w-48">
            <Field label="Pays">
              <select
                className={INPUT}
                value={selected ?? ''}
                onChange={(event) =>
                  setCountryId(Number.parseInt(event.target.value, 10))
                }
              >
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}

        <div className="w-64">
          <Field label="Nom de la ville">
            <input
              className={INPUT}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        </div>

        <Button
          label="Envoyer la demande"
          variant="secondary"
          disabled={name.trim().length < 2 || selected === null || request.isPending}
          onPress={() => request.mutate()}
        />
      </div>
    </Card>
  )
}

/**
 * Les gares de l'agence.
 *
 * **Le premier maillon de l'inventaire** : un itinéraire relie deux gares, et
 * sans gare il n'y a ni itinéraire, ni horaire, ni départ. C'est donc la
 * première page de l'espace, et celle qui accueille une agence qui vient d'être
 * validée.
 *
 * Une gare créée ici n'apparaît pas tout de suite dans la recherche : elle
 * attend une modération (B1). Le dire évite qu'une agence conclue à une panne en
 * ne la retrouvant pas.
 */
export function StationsPage() {
  const stations = useStations()
  const [adding, setAdding] = useState(false)

  const rows = stations.data?.data ?? []

  return (
    <div>
      <PageHeader
        title="Gares"
        subtitle="Les points de départ et d’arrivée de vos itinéraires. Une gare nouvelle est vérifiée par MOTOBOY avant d’apparaître dans la recherche."
        action={<Button label="Ajouter une gare" onPress={() => setAdding(true)} />}
      />

      {stations.isPending ? <Skeleton /> : null}
      {stations.error ? <ErrorNote message={describeError(stations.error)} /> : null}

      <div className="mb-6">
        <RequestCity />
      </div>

      {stations.data !== undefined && rows.length === 0 ? (
        <EmptyState
          title="Aucune gare"
          body="Commencez par déclarer une gare : tout le reste de l’inventaire s’y rattache."
          action={<Button label="Ajouter une gare" onPress={() => setAdding(true)} />}
        />
      ) : null}

      {rows.length === 0 ? null : (
        <Table head={['Nom', 'Ville', 'Adresse', 'État']}>
          {rows.map((station) => (
            <tr key={station.id}>
              <Cell className="font-medium">{station.name}</Cell>
              <Cell>{station.city ?? '—'}</Cell>
              <Cell className="text-neutral-500">{station.address ?? '—'}</Cell>
              <Cell>
                <StationState
                  moderated={
                    station.moderated_at !== null && station.moderated_at !== undefined
                  }
                  active={station.is_active}
                />
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      {adding ? <StationPanel onClose={() => setAdding(false)} /> : null}
    </div>
  )
}

/**
 * Trois états, et non deux.
 *
 * « En vérification » n'est ni actif ni inactif. Les confondre ferait croire à
 * une erreur de saisie là où il n'y a qu'une attente normale, et une agence
 * ressaisirait sa gare.
 */
function StationState({ moderated, active }: { moderated: boolean; active: boolean }) {
  if (!moderated) {
    return (
      <span className="rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700">
        En vérification
      </span>
    )
  }

  return active ? (
    <span className="rounded-full bg-success-50 px-2 py-1 text-xs text-success-700">
      Active
    </span>
  ) : (
    <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
      Inactive
    </span>
  )
}

function StationPanel({ onClose }: { onClose: () => void }) {
  const create = useCreateStation()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState<CityChoice | null>(null)

  return (
    <Panel title="Nouvelle gare" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()

          if (city === null) return

          create.mutate(
            {
              city_id: city.id,
              name: name.trim(),
              ...(address.trim() === '' ? {} : { address: address.trim() }),
            },
            { onSuccess: onClose },
          )
        }}
      >
        <Field label="Nom de la gare">
          <input
            className={INPUT}
            required
            maxLength={150}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Gare de Bonabéri"
          />
        </Field>

        <CityField label="Ville" value={city} onChange={setCity} />

        <Field label="Adresse (facultatif)">
          <input
            className={INPUT}
            maxLength={255}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </Field>

        {create.error ? <ErrorNote message={describeError(create.error)} /> : null}

        <Button
          type="submit"
          label="Créer la gare"
          disabled={city === null || name.trim() === '' || create.isPending}
        />
      </form>
    </Panel>
  )
}
