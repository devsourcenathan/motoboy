import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgencyVehicle } from '@motoboy/api-client/types'
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
import { useCreateVehicle, useVehicleSeats, useVehicles } from './useInventory'

/**
 * Le parc de l'agence.
 *
 * **Le mode de placement se décide ici et engage tout le reste.** En `SEATED`,
 * la plateforme génère un plan de sièges et chaque passager en choisit un ; en
 * `CAPACITY`, elle ne compte que des places. Un véhicule déclaré dans le mauvais
 * mode donnera des départs qu'on ne peut pas corriger sans toucher aux
 * réservations déjà prises.
 */
export function VehiclesPage() {
  const { t } = useTranslation()
  const vehicles = useVehicles()
  const [adding, setAdding] = useState(false)
  const [seatsOf, setSeatsOf] = useState<AgencyVehicle | null>(null)

  const rows = vehicles.data?.data ?? []

  return (
    <div>
      <PageHeader
        title={t('agency:inventory.vehicles.title')}
        subtitle={t('agency:inventory.vehicles.subtitle')}
        action={
          <Button
            label={t('agency:inventory.vehicles.add')}
            onPress={() => setAdding(true)}
          />
        }
      />

      {vehicles.isPending ? <Skeleton /> : null}
      {vehicles.error ? <ErrorNote message={describeError(vehicles.error)} /> : null}

      {vehicles.data !== undefined && rows.length === 0 ? (
        <EmptyState
          title={t('agency:inventory.vehicles.emptyTitle')}
          body={t('agency:inventory.vehicles.emptyBody')}
          action={
            <Button
              label={t('agency:inventory.vehicles.add')}
              onPress={() => setAdding(true)}
            />
          }
        />
      ) : null}

      {rows.length === 0 ? null : (
        <Table
          head={[
            t('agency:inventory.vehicles.head.plate'),
            t('agency:inventory.vehicles.head.model'),
            t('agency:inventory.vehicles.head.type'),
            t('agency:inventory.vehicles.head.seating'),
            t('agency:inventory.vehicles.head.seats'),
            '',
          ]}
        >
          {rows.map((vehicle) => (
            <tr key={vehicle.id}>
              <Cell className="font-mono font-medium">{vehicle.registration}</Cell>
              <Cell>
                {[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || '—'}
              </Cell>
              <Cell>{vehicle.type}</Cell>
              <Cell>
                {vehicle.seating_mode === 'SEATED'
                  ? t('agency:inventory.vehicles.assignedSeat')
                  : t('agency:inventory.vehicles.byCapacity')}
              </Cell>
              <Cell>{vehicle.capacity}</Cell>
              <Cell>
                {/*
                  Le plan ne se consulte que pour les véhicules qui en ont un :
                  proposer un lien vide sur un véhicule à capacité laisserait
                  croire à un plan manquant.
                */}
                {vehicle.seating_mode === 'SEATED' ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-brand-600 hover:underline"
                    onClick={() => setSeatsOf(vehicle)}
                  >
                    Voir le plan
                  </button>
                ) : null}
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      {adding ? <VehiclePanel onClose={() => setAdding(false)} /> : null}
      {seatsOf === null ? null : (
        <SeatMapPanel vehicle={seatsOf} onClose={() => setSeatsOf(null)} />
      )}
    </div>
  )
}

function VehiclePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const create = useCreateVehicle()
  const [registration, setRegistration] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  // Deux types seulement : c'est ce que le référentiel connaît (`VehicleType`).
  const [type, setType] = useState<'BUS' | 'CAR'>('BUS')
  const [mode, setMode] = useState<'SEATED' | 'CAPACITY'>('SEATED')
  const [capacity, setCapacity] = useState('30')

  return (
    <Panel title={t('agency:inventory.vehicles.newTitle')} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()

          create.mutate(
            {
              registration: registration.trim().toUpperCase(),
              ...(brand.trim() === '' ? {} : { brand: brand.trim() }),
              ...(model.trim() === '' ? {} : { model: model.trim() }),
              type,
              seating_mode: mode,
              capacity: Number(capacity),
            },
            { onSuccess: onClose },
          )
        }}
      >
        <Field label={t('agency:inventory.vehicles.plate')}>
          <input
            className={`${INPUT} uppercase`}
            required
            maxLength={20}
            value={registration}
            onChange={(event) => setRegistration(event.target.value)}
            placeholder={t('agency:inventory.vehicles.platePlaceholder')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('agency:inventory.vehicles.make')}>
            <input
              className={INPUT}
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
            />
          </Field>
          <Field label={t('agency:inventory.vehicles.model')}>
            <input
              className={INPUT}
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </Field>
        </div>

        <Field label={t('agency:inventory.vehicles.type')}>
          <select
            className={INPUT}
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
          >
            <option value="BUS">{t('agency:inventory.vehicles.bus')}</option>
            <option value="CAR">{t('agency:inventory.vehicles.car')}</option>
          </select>
        </Field>

        {/*
          Le choix qui engage le plus, donc celui qu'on explique. Une agence qui
          se trompe ici ne s'en aperçoit qu'au premier départ vendu.
        */}
        <Field
          label={t('agency:inventory.vehicles.seating')}
          hint={
            mode === 'SEATED'
              ? t('agency:inventory.vehicles.seatedHint')
              : t('agency:inventory.vehicles.capacityHint')
          }
        >
          <select
            className={INPUT}
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
          >
            <option value="SEATED">{t('agency:inventory.vehicles.assignedSeat')}</option>
            <option value="CAPACITY">{t('agency:inventory.vehicles.byCapacity')}</option>
          </select>
        </Field>

        <Field label={t('agency:inventory.vehicles.seats')}>
          <input
            className={INPUT}
            type="number"
            required
            min={1}
            max={100}
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
        </Field>

        {create.error ? <ErrorNote message={describeError(create.error)} /> : null}

        <Button
          type="submit"
          label={t('agency:inventory.vehicles.create')}
          disabled={registration.trim() === '' || create.isPending}
        />
      </form>
    </Panel>
  )
}

/**
 * Le plan de sièges, en lecture.
 *
 * Généré par la plateforme à la déclaration du véhicule. On le montre pour que
 * l'agence vérifie qu'il correspond à la réalité de son bus — c'est ce plan que
 * verra le passager, et un siège de trop se remarque le jour de l'embarquement.
 */
function SeatMapPanel({
  vehicle,
  onClose,
}: {
  vehicle: AgencyVehicle
  onClose: () => void
}) {
  const seats = useVehicleSeats(vehicle.id)

  return (
    <Panel title={`Plan — ${vehicle.registration}`} onClose={onClose}>
      {seats.isPending ? <Skeleton rows={3} /> : null}
      {seats.error ? <ErrorNote message={describeError(seats.error)} /> : null}

      {seats.data === undefined ? null : (
        <>
          <p className="mb-3 text-sm text-neutral-500">
            {seats.data.data.length} sièges. C’est ce plan que verra le passager.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {seats.data.data.map((seat) => (
              <div
                key={seat.id}
                className="rounded-lg border border-neutral-200 py-2 text-center text-sm"
              >
                {seat.label}
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}
