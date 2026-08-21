import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgencyRoute } from '@motoboy/api-client/types'
import { formatMoney } from '@motoboy/shared'
import { describeError } from '../../lib/errors'
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  SheetForm,
  SkeletonText,
} from '../../shared/ui'
import {
  useCreateRoute,
  useCreateSchedule,
  useDrivers,
  useGenerateTrips,
  useRoutes,
  useStations,
  useVehicles,
} from './useInventory'

/** Les jours, dans l'ordre où on les lit ici. Lundi d'abord, pas dimanche. */
const DAYS = [
  { value: 1, short: 'L' },
  { value: 2, short: 'M' },
  { value: 3, short: 'M' },
  { value: 4, short: 'J' },
  { value: 5, short: 'V' },
  { value: 6, short: 'S' },
  { value: 7, short: 'D' },
] as const

/**
 * Les itinéraires et leurs horaires.
 *
 * **Trois notions distinctes, et les confondre est l'erreur qui coûte le plus.**
 * Un *itinéraire* relie deux gares. Un *horaire* dit « tous les lundis à 7 h,
 * avec ce véhicule, à ce prix ». Un *départ* est une occurrence réelle, celle que
 * le passager réserve. L'agence saisit les deux premiers ; la plateforme génère
 * le troisième — sinon il faudrait ressaisir la même ligne chaque semaine.
 */
export function RoutesPage() {
  const { t } = useTranslation()
  const routes = useRoutes()
  const [adding, setAdding] = useState(false)
  const [scheduling, setScheduling] = useState<AgencyRoute | null>(null)

  const rows = routes.data?.data ?? []

  return (
    <div>
      <PageHeader
        title={t('agency:inventory.routes.title')}
        subtitle={t('agency:inventory.routes.subtitle')}
        action={
          <Button
            label={t('agency:inventory.routes.add')}
            onPress={() => setAdding(true)}
          />
        }
      />

      {/*
        Des cartes empilées, pas un tableau : c'est ce que cette page rend, et
        annoncer la mauvaise forme fait tressauter l'écran au chargement.
      */}
      {routes.isPending ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((index) => (
            <Card key={index}>
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
      ) : null}
      {routes.error ? <ErrorNote message={describeError(routes.error)} /> : null}

      {routes.data !== undefined && rows.length === 0 ? (
        <EmptyState
          title={t('agency:inventory.routes.emptyTitle')}
          body={t('agency:inventory.routes.emptyBody')}
          action={
            <Button
              label={t('agency:inventory.routes.add')}
              onPress={() => setAdding(true)}
            />
          }
        />
      ) : null}

      <div className="flex flex-col gap-4">
        {rows.map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            onSchedule={() => setScheduling(route)}
          />
        ))}
      </div>

      {rows.length === 0 ? null : <GenerateCard />}

      {adding ? <RoutePanel onClose={() => setAdding(false)} /> : null}
      {scheduling === null ? null : (
        <SchedulePanel route={scheduling} onClose={() => setScheduling(null)} />
      )}
    </div>
  )
}

/**
 * Un itinéraire et ses horaires.
 *
 * Sorti du corps de la page, qui faisait quatre métiers dans une seule fonction
 * de cent cinquante lignes : l'en-tête, l'attente, la liste, et le geste de
 * génération. Chacun se relit maintenant seul.
 */
function RouteCard({
  route,
  onSchedule,
}: {
  route: AgencyRoute
  onSchedule: () => void
}) {
  const { t } = useTranslation()

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-neutral-900">
            {route.origin.station} → {route.destination.station}
          </p>
          <p className="text-sm text-neutral-500">
            {route.origin.city} → {route.destination.city}
            {route.reference_duration_minutes === null ||
            route.reference_duration_minutes === undefined
              ? ''
              : ` · ${route.reference_duration_minutes} min`}
          </p>
        </div>
        <Button
          label={t('agency:inventory.routes.addSchedule')}
          variant="secondary"
          icon="trips"
          onPress={onSchedule}
        />
      </div>

      {route.schedules.length === 0 ? (
        // **Un itinéraire sans horaire ne produit rien.** Le taire laisserait
        // croire le travail fait, jusqu'à ce que la recherche ne renvoie rien.
        <p className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500">
          Aucun horaire : cet itinéraire ne produit aucun départ, et n’apparaît donc pas
          dans la recherche.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {route.schedules.map((schedule) => (
            <li
              key={schedule.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-2 text-sm"
            >
              <span className="font-mono font-medium tabular-nums">
                {schedule.departure_time}
              </span>
              <DayDots days={schedule.days_of_week} />
              <span className="font-semibold tabular-nums">
                {formatMoney(schedule.price, 'fr')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/**
 * Le geste qui rend l'inventaire visible.
 *
 * Jusqu'ici les horaires ne sont que des intentions : tant qu'on n'a pas
 * généré, la recherche ne renvoie rien et l'agence croit son travail perdu.
 */
function GenerateCard() {
  const { t } = useTranslation()
  const generate = useGenerateTrips()

  return (
    <Card className="mt-6">
      <p className="font-semibold text-neutral-900">
        {t('agency:inventory.routes.generate')}
      </p>
      <p className="mt-1 mb-4 text-sm text-neutral-500">
        Les horaires décrivent une intention ; les départs sont ce que le passager
        réserve. La génération ne touche jamais un départ existant — elle ne fait
        qu’ajouter les manquants.
      </p>

      {/*
        L'attente est portée par le bouton, non par un second libellé. Échanger
        le texte contre « Génération… » changeait sa largeur et déplaçait ce
        qu'on venait de lire.
      */}
      <Button
        label={t('agency:inventory.routes.generateNow')}
        onPress={() => generate.mutate()}
        loading={generate.isPending}
      />

      {generate.data === undefined ? null : (
        <p className="mt-3 text-sm text-success-700">
          {generate.data.created} départ{generate.data.created > 1 ? 's' : ''} créé
          {generate.data.created > 1 ? 's' : ''} sur {generate.data.horizon_days} jours.
        </p>
      )}
      {generate.error ? <ErrorNote message={describeError(generate.error)} /> : null}
    </Card>
  )
}

/** La pastille d'un jour : même dessin qu'on la lise ou qu'on la choisisse. */
const DAY_DOT = 'flex items-center justify-center rounded-full text-xs transition-colors'

/** Les sept jours d'un horaire, en lecture. */
function DayDots({ days }: { days: readonly number[] }) {
  return (
    <span className="flex gap-1">
      {DAYS.map((day) => (
        <span
          key={day.value}
          className={`${DAY_DOT} h-6 w-6 ${
            days.includes(day.value)
              ? 'bg-ink-700 text-neutral-0'
              : 'bg-neutral-100 text-neutral-500'
          }`}
        >
          {day.short}
        </span>
      ))}
    </span>
  )
}

/**
 * Les mêmes sept jours, à choisir.
 *
 * En boutons plutôt qu'en liste à cocher : un horaire se lit d'un coup d'œil, et
 * sept cases empilées prennent la moitié du panneau. `aria-pressed` dit l'état
 * que la couleur montre.
 */
function DayPicker({
  value,
  onChange,
}: {
  value: readonly number[]
  onChange: (next: number[]) => void
}) {
  return (
    <div className="mt-1 flex gap-1">
      {DAYS.map((day) => (
        <button
          key={day.value}
          type="button"
          aria-pressed={value.includes(day.value)}
          onClick={() =>
            onChange(
              value.includes(day.value)
                ? value.filter((entry) => entry !== day.value)
                : [...value, day.value].sort(),
            )
          }
          className={`${DAY_DOT} h-9 w-9 text-sm ${
            value.includes(day.value)
              ? 'bg-ink-700 font-semibold text-neutral-0'
              : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
          }`}
        >
          {day.short}
        </button>
      ))}
    </div>
  )
}

function RoutePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const create = useCreateRoute()
  const stations = useStations()
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [duration, setDuration] = useState('')

  const rows = stations.data?.data ?? []

  return (
    <SheetForm
      title={t('agency:inventory.routes.newTitle')}
      onClose={onClose}
      submitLabel={t('agency:inventory.routes.create')}
      submitDisabled={origin === '' || destination === ''}
      pending={create.isPending}
      error={create.error ? describeError(create.error) : undefined}
      onSubmit={() => {
        create.mutate(
          {
            origin_station_id: Number(origin),
            destination_station_id: Number(destination),
            ...(duration === '' ? {} : { reference_duration_minutes: Number(duration) }),
          },
          { onSuccess: onClose },
        )
      }}
    >
      <Field label={t('agency:inventory.routes.origin')}>
        <select
          className={INPUT}
          required
          value={origin}
          onChange={(event) => setOrigin(event.target.value)}
        >
          <option value="">{t('agency:inventory.routes.choose')}</option>
          {rows.map((station) => (
            <option key={station.id} value={station.id}>
              {station.name} — {station.city}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('agency:inventory.routes.destination')}>
        <select
          className={INPUT}
          required
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
        >
          <option value="">{t('agency:inventory.routes.choose')}</option>
          {rows
            // Une gare ne se relie pas à elle-même : l'écarter vaut mieux que
            // de laisser choisir puis refuser.
            .filter((station) => String(station.id) !== origin)
            .map((station) => (
              <option key={station.id} value={station.id}>
                {station.name} — {station.city}
              </option>
            ))}
        </select>
      </Field>

      <Field
        label={t('agency:inventory.routes.duration')}
        hint={t('agency:inventory.routes.durationHint')}
      >
        <input
          className={INPUT}
          type="number"
          min={1}
          max={2880}
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
        />
      </Field>
    </SheetForm>
  )
}

function SchedulePanel({ route, onClose }: { route: AgencyRoute; onClose: () => void }) {
  const { t } = useTranslation()
  const create = useCreateSchedule(route.id)
  const vehicles = useVehicles()
  const drivers = useDrivers()

  const [time, setTime] = useState('07:00')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7])
  const [vehicleId, setVehicleId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [price, setPrice] = useState('')
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10))

  return (
    <SheetForm
      title={`Horaire — ${route.origin.station} → ${route.destination.station}`}
      onClose={onClose}
      submitLabel={t('agency:inventory.routes.createSchedule')}
      submitDisabled={days.length === 0 || vehicleId === '' || price === ''}
      pending={create.isPending}
      error={create.error ? describeError(create.error) : undefined}
      onSubmit={() => {
        create.mutate(
          {
            departure_time: time,
            days_of_week: days,
            default_vehicle_id: Number(vehicleId),
            ...(driverId === '' ? {} : { default_driver_id: Number(driverId) }),
            /*
             * Un entier à l'entrée, un `Money` à la lecture : le contrat est
             * asymétrique sur ce champ. On suit ce qu'il dit plutôt que ce
             * qu'on suppose — le typage l'a rattrapé.
             */
            price: Number(price),
            valid_from: from,
          },
          { onSuccess: onClose },
        )
      }}
    >
      <Field label={t('agency:inventory.routes.departureTime')}>
        <input
          className={INPUT}
          type="time"
          required
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
      </Field>

      <Field label={t('agency:inventory.routes.days')}>
        <DayPicker value={days} onChange={setDays} />
      </Field>

      <Field label={t('agency:inventory.routes.vehicle')}>
        <select
          className={INPUT}
          required
          value={vehicleId}
          onChange={(event) => setVehicleId(event.target.value)}
        >
          <option value="">{t('agency:inventory.routes.choose')}</option>
          {(vehicles.data?.data ?? []).map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.registration} — {vehicle.capacity} places
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('agency:inventory.routes.driver')}>
        <select
          className={INPUT}
          value={driverId}
          onChange={(event) => setDriverId(event.target.value)}
        >
          <option value="">{t('agency:inventory.routes.unassigned')}</option>
          {(drivers.data?.data ?? []).map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.first_name} {driver.last_name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('agency:inventory.routes.price')}>
        <input
          className={INPUT}
          type="number"
          required
          min={100}
          step={100}
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="6500"
        />
      </Field>

      <Field
        label={t('agency:inventory.routes.from')}
        hint={t('agency:inventory.routes.fromHint')}
      >
        <input
          className={INPUT}
          type="date"
          required
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </Field>
    </SheetForm>
  )
}
