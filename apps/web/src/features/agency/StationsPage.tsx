import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { unwrap } from '@motoboy/api-client'
import { api } from '../../lib/api'
import type { AgencyStation } from '@motoboy/api-client/types'
import { describeError } from '../../lib/errors'
import {
  Badge,
  Button,
  Card,
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  SheetForm,
  SkeletonTable,
  Table,
} from '../../shared/ui'
import { CityField, type CityChoice } from './CityField'
import { useCreateStation, useStations, useUpdateStation } from './useInventory'

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
  const { t } = useTranslation()
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
      <p className="mb-1 font-semibold text-neutral-900">
        {t('agency:inventory.stations.requestCity')}
      </p>
      <p className="mb-3 text-sm text-neutral-500">
        {t('agency:inventory.stations.requestCityHelp')}
      </p>

      {request.error ? <ErrorNote message={describeError(request.error)} /> : null}

      {request.isSuccess ? (
        <p className="mb-3 text-sm text-success-700">
          {t('agency:inventory.stations.requestSent')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        {/*
          Le sélecteur ne s'affiche qu'au-delà d'un pays : en proposer un seul
          demanderait un choix qui n'en est pas un.
        */}
        {countries.length > 1 ? (
          <div className="w-48">
            <Field label={t('agency:inventory.stations.country')}>
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
          <Field label={t('agency:inventory.stations.cityName')}>
            <input
              className={INPUT}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        </div>

        <Button
          label={t('agency:inventory.stations.sendRequest')}
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
  const { t } = useTranslation()
  const stations = useStations()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AgencyStation | null>(null)

  const rows = stations.data?.data ?? []

  return (
    <div>
      <PageHeader
        title={t('agency:inventory.stations.title')}
        subtitle={t('agency:inventory.stations.subtitle')}
        action={
          <Button
            label={t('agency:inventory.stations.add')}
            onPress={() => setAdding(true)}
          />
        }
      />

      {stations.isPending ? <SkeletonTable columns={5} /> : null}
      {stations.error ? <ErrorNote message={describeError(stations.error)} /> : null}

      <div className="mb-6">
        <RequestCity />
      </div>

      {stations.data !== undefined && rows.length === 0 ? (
        <EmptyState
          title={t('agency:inventory.stations.emptyTitle')}
          body={t('agency:inventory.stations.emptyBody')}
          action={
            <Button
              label={t('agency:inventory.stations.add')}
              onPress={() => setAdding(true)}
            />
          }
        />
      ) : null}

      {rows.length === 0 ? null : (
        <Table
          head={[
            t('agency:inventory.stations.head.name'),
            t('agency:inventory.stations.head.city'),
            t('agency:inventory.stations.head.address'),
            t('agency:inventory.stations.head.status'),
            '',
          ]}
        >
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
              <Cell>
                <Button
                  label="Modifier"
                  variant="ghost"
                  size="sm"
                  onPress={() => setEditing(station)}
                />
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      {adding ? <StationPanel onClose={() => setAdding(false)} /> : null}
      {editing === null ? null : (
        <StationEditPanel station={editing} onClose={() => setEditing(null)} />
      )}
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
  if (!moderated) return <Badge label="En vérification" tone="action" />

  return active ? <Badge label="Active" tone="good" /> : <Badge label="Inactive" />
}

/**
 * Corriger une gare, ou la désactiver.
 *
 * **L'endpoint existait depuis le début et aucun écran ne l'appelait.** Une
 * gare mal nommée l'était pour toujours, et une gare fermée continuait de
 * figurer dans les itinéraires.
 *
 * La **ville ne se change pas** : une gare rattachée ailleurs déplacerait les
 * itinéraires qui la traversent, et donc des départs déjà vendus. Une gare
 * d'une autre ville est une autre gare.
 *
 * Désactiver plutôt que supprimer, comme partout : les itinéraires et les
 * départs passés la référencent, et l'effacer réécrirait ce qui a eu lieu.
 */
function StationEditPanel({
  station,
  onClose,
}: {
  station: AgencyStation
  onClose: () => void
}) {
  const { t } = useTranslation()
  const update = useUpdateStation()

  const [name, setName] = useState(station.name)
  const [address, setAddress] = useState(station.address ?? '')
  const [active, setActive] = useState(station.is_active)

  return (
    <SheetForm
      title={station.name}
      description={station.city ?? undefined}
      onClose={onClose}
      submitLabel="Enregistrer"
      submitDisabled={name.trim() === ''}
      pending={update.isPending}
      error={update.error ? describeError(update.error) : undefined}
      onSubmit={() =>
        update.mutate(
          {
            id: station.id,
            name: name.trim(),
            address: address.trim() === '' ? null : address.trim(),
            is_active: active,
          } as never,
          { onSuccess: onClose },
        )
      }
    >
      <Field label={t('agency:inventory.stations.name')}>
        <input
          className={INPUT}
          required
          maxLength={150}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

      <Field label={t('agency:inventory.stations.address')}>
        <input
          className={INPUT}
          maxLength={255}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
      </Field>

      <Field
        label="État"
        hint={
          active
            ? undefined
            : 'Une gare désactivée disparaît des nouveaux itinéraires. Ceux qui l’utilisent déjà ne changent pas.'
        }
      >
        <select
          className={INPUT}
          value={active ? 'ACTIVE' : 'INACTIVE'}
          onChange={(event) => setActive(event.target.value === 'ACTIVE')}
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </Field>
    </SheetForm>
  )
}

function StationPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const create = useCreateStation()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState<CityChoice | null>(null)

  return (
    <SheetForm
      title={t('agency:inventory.stations.newTitle')}
      onClose={onClose}
      submitLabel={t('agency:inventory.stations.create')}
      submitDisabled={city === null || name.trim() === ''}
      pending={create.isPending}
      error={create.error ? describeError(create.error) : undefined}
      onSubmit={() => {
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
      <Field label={t('agency:inventory.stations.name')}>
        <input
          className={INPUT}
          required
          maxLength={150}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('agency:inventory.stations.namePlaceholder')}
        />
      </Field>

      <CityField
        label={t('agency:inventory.stations.city')}
        value={city}
        onChange={setCity}
      />

      <Field label={t('agency:inventory.stations.address')}>
        <input
          className={INPUT}
          maxLength={255}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
      </Field>
    </SheetForm>
  )
}
