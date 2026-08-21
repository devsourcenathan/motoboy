import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { describeError } from '../../lib/errors'
import {
  Badge,
  Button,
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  SheetForm,
  SkeletonCards,
  SkeletonTable,
  StatCard,
  Table,
} from '../../shared/ui'
import { useCreateDriver, useDrivers, useVehicles } from './useInventory'

/**
 * Les chauffeurs de l'agence.
 *
 * **À ne pas confondre avec les chauffeurs indépendants** de l'appel de service :
 * ceux-ci travaillent pour l'agence, qui répond d'eux, et ne passent donc pas par
 * la file de modération de MOTOBOY. C'est l'agence qui garantit leur permis, et
 * c'est pourquoi son échéance est saisie ici.
 */
export function DriversPage() {
  const { t } = useTranslation()
  const drivers = useDrivers()
  const [adding, setAdding] = useState(false)

  const rows = drivers.data?.data ?? []

  return (
    <div>
      <PageHeader
        title={t('agency:inventory.drivers.title')}
        subtitle={t('agency:inventory.drivers.subtitle')}
        action={
          <Button
            label={t('agency:inventory.drivers.add')}
            onPress={() => setAdding(true)}
          />
        }
      />

      {drivers.isPending ? (
        <div className="flex flex-col gap-4">
          <SkeletonCards count={3} columns={3} />
          <SkeletonTable columns={5} />
        </div>
      ) : null}
      {drivers.error ? <ErrorNote message={describeError(drivers.error)} /> : null}

      {rows.length === 0 ? null : <Fleet rows={rows} />}

      {drivers.data !== undefined && rows.length === 0 ? (
        <EmptyState
          title={t('agency:inventory.drivers.emptyTitle')}
          body={t('agency:inventory.drivers.emptyBody')}
          action={
            <Button
              label={t('agency:inventory.drivers.add')}
              onPress={() => setAdding(true)}
            />
          }
        />
      ) : null}

      {rows.length === 0 ? null : (
        <Table
          head={[
            t('agency:inventory.drivers.head.name'),
            t('agency:inventory.drivers.head.phone'),
            t('agency:inventory.drivers.head.licence'),
            t('agency:inventory.drivers.head.expiry'),
            t('agency:inventory.drivers.head.status'),
          ]}
        >
          {rows.map((driver) => (
            <tr key={driver.id}>
              <Cell className="font-medium">
                {driver.first_name} {driver.last_name}
              </Cell>
              <Cell>{driver.phone}</Cell>
              <Cell className="font-mono text-neutral-500">{driver.license_number}</Cell>
              <Cell>
                <Expiry date={driver.license_expires_at ?? null} />
              </Cell>
              <Cell>{driver.status}</Cell>
            </tr>
          ))}
        </Table>
      )}

      {adding ? <DriverPanel onClose={() => setAdding(false)} /> : null}
    </div>
  )
}

/**
 * L'échéance du permis, signalée quand elle approche.
 *
 * Une date brute se lit sans être comprise : c'est la veille du contrôle qu'on
 * découvre qu'un permis a expiré. Trente jours laissent le temps de le renouveler.
 */
/**
 * Ce que la liste ne montre pas d'un coup d'œil.
 *
 * **Un permis qui expire est enfoui dans une cellule.** Il faut parcourir la
 * colonne pour s'en apercevoir, et une agence de vingt chauffeurs ne le fait
 * pas — jusqu'au jour où un contrôle routier le fait pour elle.
 *
 * Calculé sur la liste déjà chargée : aucun appel de plus, et le compte ne peut
 * pas diverger de ce qui est affiché en dessous.
 */
function Fleet({ rows }: { rows: readonly { license_expires_at?: string | null }[] }) {
  const now = Date.now()

  const expired = rows.filter(
    (row) =>
      row.license_expires_at !== null &&
      new Date(row.license_expires_at ?? '').getTime() < now,
  ).length

  const soon = rows.filter((row) => {
    if (row.license_expires_at === null || row.license_expires_at === undefined)
      return false

    const days = (new Date(row.license_expires_at).getTime() - now) / 86_400_000

    return days >= 0 && days <= 30
  }).length

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <StatCard label="Chauffeurs" value={String(rows.length)} icon="drivers" />
      <StatCard
        label="Permis à renouveler"
        value={String(soon)}
        hint="Dans les trente jours"
        icon="alert"
        tone={soon > 0 ? 'action' : 'neutral'}
      />
      <StatCard
        label="Permis expirés"
        value={String(expired)}
        hint="Ne devraient plus conduire"
        icon="alert"
        tone={expired > 0 ? 'alert' : 'neutral'}
      />
    </div>
  )
}

function Expiry({ date }: { date: string | null }) {
  if (date === null) return <span className="text-neutral-500">—</span>

  const days = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000)
  const formatted = new Date(date).toLocaleDateString('fr')

  if (days < 0) {
    return <Badge label={`Expiré le ${formatted}`} tone="alert" />
  }

  if (days <= 30) {
    return <Badge label={`Expire dans ${days} j`} tone="action" />
  }

  return <span>{formatted}</span>
}

function DriverPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const create = useCreateDriver()
  const vehicles = useVehicles()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [licence, setLicence] = useState('')
  const [expiry, setExpiry] = useState('')
  const [vehicleId, setVehicleId] = useState('')

  return (
    <SheetForm
      title={t('agency:inventory.drivers.newTitle')}
      onClose={onClose}
      submitLabel={t('agency:inventory.drivers.create')}
      submitDisabled={firstName.trim() === '' || phone.trim() === ''}
      pending={create.isPending}
      error={create.error ? describeError(create.error) : undefined}
      onSubmit={() => {
        create.mutate(
          {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim(),
            license_number: licence.trim(),
            ...(expiry === '' ? {} : { license_expires_at: expiry }),
            ...(vehicleId === '' ? {} : { assigned_vehicle_id: Number(vehicleId) }),
          },
          { onSuccess: onClose },
        )
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('agency:inventory.drivers.firstName')}>
          <input
            className={INPUT}
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </Field>
        <Field label={t('agency:inventory.drivers.lastName')}>
          <input
            className={INPUT}
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </Field>
      </div>

      <Field label={t('agency:inventory.drivers.phone')}>
        <input
          className={INPUT}
          required
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder={t('agency:inventory.drivers.phonePlaceholder')}
        />
      </Field>

      <Field label={t('agency:inventory.drivers.licence')}>
        <input
          className={INPUT}
          required
          value={licence}
          onChange={(event) => setLicence(event.target.value)}
        />
      </Field>

      <Field
        label={t('agency:inventory.drivers.licenceExpiry')}
        hint={t('agency:inventory.drivers.licenceExpiryHint')}
      >
        <input
          className={INPUT}
          type="date"
          value={expiry}
          onChange={(event) => setExpiry(event.target.value)}
        />
      </Field>

      {/*
        L'affectation est un défaut, pas une contrainte : elle prérenseigne les
        horaires. Un chauffeur peut conduire un autre véhicule un jour donné.
      */}
      <Field label={t('agency:inventory.drivers.usualVehicle')}>
        <select
          className={INPUT}
          value={vehicleId}
          onChange={(event) => setVehicleId(event.target.value)}
        >
          <option value="">{t('agency:inventory.drivers.none')}</option>
          {(vehicles.data?.data ?? []).map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.registration}
            </option>
          ))}
        </select>
      </Field>
    </SheetForm>
  )
}
