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
  const drivers = useDrivers()
  const [adding, setAdding] = useState(false)

  const rows = drivers.data?.data ?? []

  return (
    <div>
      <PageHeader
        title="Chauffeurs"
        subtitle="Vos chauffeurs salariés. Vous répondez de leur permis — MOTOBOY ne les modère pas."
        action={<Button label="Ajouter un chauffeur" onPress={() => setAdding(true)} />}
      />

      {drivers.isPending ? <Skeleton /> : null}
      {drivers.error ? <ErrorNote message={describeError(drivers.error)} /> : null}

      {drivers.data !== undefined && rows.length === 0 ? (
        <EmptyState
          title="Aucun chauffeur"
          body="Un horaire peut désigner un chauffeur par défaut ; sans chauffeur déclaré, ce choix reste vide."
          action={<Button label="Ajouter un chauffeur" onPress={() => setAdding(true)} />}
        />
      ) : null}

      {rows.length === 0 ? null : (
        <Table head={['Nom', 'Téléphone', 'Permis', 'Échéance', 'État']}>
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
function Expiry({ date }: { date: string | null }) {
  if (date === null) return <span className="text-neutral-500">—</span>

  const days = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000)
  const formatted = new Date(date).toLocaleDateString('fr')

  if (days < 0) {
    return (
      <span className="rounded-full bg-danger-soft px-2 py-1 text-xs text-danger-strong">
        Expiré le {formatted}
      </span>
    )
  }

  if (days <= 30) {
    return (
      <span className="rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700">
        Expire dans {days} j
      </span>
    )
  }

  return <span>{formatted}</span>
}

function DriverPanel({ onClose }: { onClose: () => void }) {
  const create = useCreateDriver()
  const vehicles = useVehicles()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [licence, setLicence] = useState('')
  const [expiry, setExpiry] = useState('')
  const [vehicleId, setVehicleId] = useState('')

  return (
    <Panel title="Nouveau chauffeur" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()

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
          <Field label="Prénom">
            <input
              className={INPUT}
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </Field>
          <Field label="Nom">
            <input
              className={INPUT}
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Téléphone">
          <input
            className={INPUT}
            required
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+237 6XX XX XX XX"
          />
        </Field>

        <Field label="Numéro de permis">
          <input
            className={INPUT}
            required
            value={licence}
            onChange={(event) => setLicence(event.target.value)}
          />
        </Field>

        <Field
          label="Échéance du permis (facultatif)"
          hint="Renseignée, elle est signalée trente jours avant l’expiration."
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
        <Field label="Véhicule habituel (facultatif)">
          <select
            className={INPUT}
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
          >
            <option value="">Aucun</option>
            {(vehicles.data?.data ?? []).map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration}
              </option>
            ))}
          </select>
        </Field>

        {create.error ? <ErrorNote message={describeError(create.error)} /> : null}

        <Button
          type="submit"
          label="Ajouter le chauffeur"
          disabled={create.isPending || firstName.trim() === '' || phone.trim() === ''}
        />
      </form>
    </Panel>
  )
}
