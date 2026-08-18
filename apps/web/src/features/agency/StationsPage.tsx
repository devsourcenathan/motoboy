import { useState } from 'react'
import { describeError } from '../../lib/errors'
import {
  Button,
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
                  moderated={station.moderated_at !== null && station.moderated_at !== undefined}
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
    <span className="rounded-full bg-success-50 px-2 py-1 text-xs text-success-700">Active</span>
  ) : (
    <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">Inactive</span>
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
