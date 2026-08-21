import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgencyVehicle } from '@motoboy/api-client/types'
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
  Sheet,
  SheetForm,
  Skeleton,
  SkeletonTable,
  Table,
} from '../../shared/ui'
import {
  useCreateVehicle,
  useUpdateVehicle,
  useVehicleSeats,
  useVehicles,
} from './useInventory'

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
  const [editing, setEditing] = useState<AgencyVehicle | null>(null)

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

      {vehicles.isPending ? <SkeletonTable columns={7} /> : null}
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
            'État',
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
              {/*
                **Un véhicule retiré ne se distinguait pas d'un véhicule en
                service.** Rien ne pouvait le retirer, donc rien n'avait à le
                montrer ; maintenant que le geste existe, son absence
                laisserait croire qu'il n'a pas pris.
              */}
              <Cell>
                <Badge
                  label={CONDITIONS[vehicle.condition ?? 'ACTIVE'] ?? 'En service'}
                  tone={vehicle.condition === 'ACTIVE' ? 'good' : 'neutral'}
                />
              </Cell>
              <Cell className="whitespace-nowrap">
                {/*
                  Le plan ne se consulte que pour les véhicules qui en ont un :
                  proposer un lien vide sur un véhicule à capacité laisserait
                  croire à un plan manquant.
                */}
                {vehicle.seating_mode === 'SEATED' ? (
                  <Button
                    label="Voir le plan"
                    variant="ghost"
                    size="sm"
                    onPress={() => setSeatsOf(vehicle)}
                  />
                ) : null}
                <Button
                  label="Modifier"
                  variant="ghost"
                  size="sm"
                  onPress={() => setEditing(vehicle)}
                />
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      {adding ? <VehiclePanel onClose={() => setAdding(false)} /> : null}
      {editing === null ? null : (
        <VehicleEditPanel vehicle={editing} onClose={() => setEditing(null)} />
      )}
      {seatsOf === null ? null : (
        <SeatMapPanel vehicle={seatsOf} onClose={() => setSeatsOf(null)} />
      )}
    </div>
  )
}

/**
 * Les états d'un véhicule, nommés.
 *
 * `MAINTENANCE` et `RETIRED` ne se valent pas : l'un revient, l'autre non. Les
 * confondre sous « inactif » ferait rayer du parc un bus qui rentre de
 * révision.
 */
const CONDITIONS: Record<string, string> = {
  ACTIVE: 'En service',
  MAINTENANCE: 'En révision',
  RETIRED: 'Retiré',
}

/**
 * Corriger un véhicule, ou le retirer du service.
 *
 * **Un panneau distinct de la création, et plus court.** Celui-ci n'offre que
 * ce qui peut encore changer : le mode de placement et la capacité sont
 * immuables — des départs vendus portent déjà un plan de sièges, et le changer
 * sous eux déplacerait des passagers placés. Les afficher grisés serait pire
 * que les omettre : on chercherait comment les débloquer.
 */
function VehicleEditPanel({
  vehicle,
  onClose,
}: {
  vehicle: AgencyVehicle
  onClose: () => void
}) {
  const { t } = useTranslation()
  const update = useUpdateVehicle()

  const [registration, setRegistration] = useState(vehicle.registration)
  const [brand, setBrand] = useState(vehicle.brand ?? '')
  const [model, setModel] = useState(vehicle.model ?? '')
  const [condition, setCondition] = useState(vehicle.condition ?? 'ACTIVE')

  return (
    <SheetForm
      title={vehicle.registration}
      description="Le placement et le nombre de sièges ne se modifient plus."
      onClose={onClose}
      submitLabel="Enregistrer"
      submitDisabled={registration.trim() === ''}
      pending={update.isPending}
      error={update.error ? describeError(update.error) : undefined}
      onSubmit={() =>
        update.mutate(
          {
            id: vehicle.id,
            registration: registration.trim().toUpperCase(),
            brand: brand.trim() === '' ? null : brand.trim(),
            model: model.trim() === '' ? null : model.trim(),
            condition: condition as 'ACTIVE' | 'MAINTENANCE' | 'RETIRED',
          },
          { onSuccess: onClose },
        )
      }
    >
      <Field label={t('agency:inventory.vehicles.plate')}>
        <input
          className={`${INPUT} uppercase`}
          required
          maxLength={20}
          value={registration}
          onChange={(event) => setRegistration(event.target.value)}
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

      {/*
        Dit sous le champ : retirer un véhicule ne retire pas les départs qu'il
        assure déjà. Sans cette phrase, une agence croit avoir annulé sa
        journée.
      */}
      <Field
        label="État"
        hint={
          condition === 'ACTIVE'
            ? undefined
            : 'Les départs déjà créés avec ce véhicule restent en vente. Les annuler se fait depuis l’onglet Départs.'
        }
      >
        <select
          className={INPUT}
          value={condition}
          onChange={(event) => setCondition(event.target.value)}
        >
          {Object.entries(CONDITIONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
    </SheetForm>
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
    <SheetForm
      title={t('agency:inventory.vehicles.newTitle')}
      onClose={onClose}
      submitLabel={t('agency:inventory.vehicles.create')}
      submitDisabled={registration.trim() === ''}
      pending={create.isPending}
      error={create.error ? describeError(create.error) : undefined}
      onSubmit={() => {
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
    </SheetForm>
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
    <Sheet
      title={`Plan — ${vehicle.registration}`}
      description="C’est ce plan que verra le passager."
      onClose={onClose}
    >
      {seats.isPending ? <Skeleton rows={3} /> : null}
      {seats.error ? <ErrorNote message={describeError(seats.error)} /> : null}

      {seats.data === undefined ? null : (
        <>
          <p className="mb-3 text-sm text-neutral-500">{seats.data.data.length} sièges</p>
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
    </Sheet>
  )
}
