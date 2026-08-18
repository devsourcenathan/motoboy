import { useState } from 'react'
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
  const vehicles = useVehicles()
  const [adding, setAdding] = useState(false)
  const [seatsOf, setSeatsOf] = useState<AgencyVehicle | null>(null)

  const rows = vehicles.data?.data ?? []

  return (
    <div>
      <PageHeader
        title="Véhicules"
        subtitle="Votre parc. Le mode de placement choisi à la déclaration détermine si les passagers choisiront leur siège."
        action={<Button label="Ajouter un véhicule" onPress={() => setAdding(true)} />}
      />

      {vehicles.isPending ? <Skeleton /> : null}
      {vehicles.error ? <ErrorNote message={describeError(vehicles.error)} /> : null}

      {vehicles.data !== undefined && rows.length === 0 ? (
        <EmptyState
          title="Aucun véhicule"
          body="Un itinéraire ne produit de départs qu’avec un véhicule pour les assurer."
          action={<Button label="Ajouter un véhicule" onPress={() => setAdding(true)} />}
        />
      ) : null}

      {rows.length === 0 ? null : (
        <Table head={['Immatriculation', 'Modèle', 'Type', 'Placement', 'Places', '']}>
          {rows.map((vehicle) => (
            <tr key={vehicle.id}>
              <Cell className="font-mono font-medium">{vehicle.registration}</Cell>
              <Cell>{[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || '—'}</Cell>
              <Cell>{vehicle.type}</Cell>
              <Cell>
                {vehicle.seating_mode === 'SEATED' ? 'Siège choisi' : 'Par capacité'}
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
  const create = useCreateVehicle()
  const [registration, setRegistration] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  // Deux types seulement : c'est ce que le référentiel connaît (`VehicleType`).
  const [type, setType] = useState<'BUS' | 'CAR'>('BUS')
  const [mode, setMode] = useState<'SEATED' | 'CAPACITY'>('SEATED')
  const [capacity, setCapacity] = useState('30')

  return (
    <Panel title="Nouveau véhicule" onClose={onClose}>
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
        <Field label="Immatriculation">
          <input
            className={`${INPUT} uppercase`}
            required
            maxLength={20}
            value={registration}
            onChange={(event) => setRegistration(event.target.value)}
            placeholder="LT-4412-AB"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Marque (facultatif)">
            <input
              className={INPUT}
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
            />
          </Field>
          <Field label="Modèle (facultatif)">
            <input
              className={INPUT}
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Type">
          <select
            className={INPUT}
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
          >
            <option value="BUS">Bus</option>
            <option value="CAR">Voiture</option>
          </select>
        </Field>

        {/*
          Le choix qui engage le plus, donc celui qu'on explique. Une agence qui
          se trompe ici ne s'en aperçoit qu'au premier départ vendu.
        */}
        <Field
          label="Mode de placement"
          hint={
            mode === 'SEATED'
              ? 'Le passager choisit son siège sur un plan. Ne se change plus une fois des départs vendus.'
              : 'Seul le nombre de places compte. Aucun plan, aucun siège attribué.'
          }
        >
          <select
            className={INPUT}
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
          >
            <option value="SEATED">Siège choisi</option>
            <option value="CAPACITY">Par capacité</option>
          </select>
        </Field>

        <Field label="Nombre de places">
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
          label="Ajouter le véhicule"
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
function SeatMapPanel({ vehicle, onClose }: { vehicle: AgencyVehicle; onClose: () => void }) {
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
