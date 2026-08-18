import { useState } from 'react'
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
  Panel,
  Skeleton,
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
  const routes = useRoutes()
  const generate = useGenerateTrips()
  const [adding, setAdding] = useState(false)
  const [scheduling, setScheduling] = useState<AgencyRoute | null>(null)

  const rows = routes.data?.data ?? []

  return (
    <div>
      <PageHeader
        title="Itinéraires et horaires"
        subtitle="Un itinéraire relie deux gares. Un horaire le fait partir régulièrement. Les départs, eux, sont générés."
        action={<Button label="Ajouter un itinéraire" onPress={() => setAdding(true)} />}
      />

      {routes.isPending ? <Skeleton /> : null}
      {routes.error ? <ErrorNote message={describeError(routes.error)} /> : null}

      {routes.data !== undefined && rows.length === 0 ? (
        <EmptyState
          title="Aucun itinéraire"
          body="Déclarez d’abord deux gares, puis reliez-les par un itinéraire."
          action={<Button label="Ajouter un itinéraire" onPress={() => setAdding(true)} />}
        />
      ) : null}

      <div className="space-y-4">
        {rows.map((route) => (
          <Card key={route.id}>
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
                label="Ajouter un horaire"
                variant="secondary"
                onPress={() => setScheduling(route)}
              />
            </div>

            {route.schedules.length === 0 ? (
              <p className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500">
                Aucun horaire : cet itinéraire ne produit aucun départ, et n’apparaît donc pas
                dans la recherche.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {route.schedules.map((schedule) => (
                  <li
                    key={schedule.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-2 text-sm"
                  >
                    <span className="font-mono font-medium">{schedule.departure_time}</span>
                    <span className="flex gap-1">
                      {DAYS.map((day) => (
                        <span
                          key={day.value}
                          className={
                            schedule.days_of_week.includes(day.value)
                              ? 'flex h-6 w-6 items-center justify-center rounded-full bg-ink-700 text-xs text-neutral-0'
                              : 'flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-xs text-neutral-500'
                          }
                        >
                          {day.short}
                        </span>
                      ))}
                    </span>
                    <span className="font-semibold">{formatMoney(schedule.price, 'fr')}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      {rows.length === 0 ? null : (
        <Card className="mt-6">
          <p className="font-semibold text-neutral-900">Générer les départs</p>
          {/*
            Le geste qui rend l'inventaire visible. Jusqu'ici les horaires ne sont
            que des intentions : tant qu'on n'a pas généré, la recherche ne renvoie
            rien et l'agence croit son travail perdu.
          */}
          <p className="mt-1 mb-4 text-sm text-neutral-500">
            Les horaires décrivent une intention ; les départs sont ce que le passager réserve.
            La génération ne touche jamais un départ existant — elle ne fait qu’ajouter les
            manquants.
          </p>

          <Button
            label={generate.isPending ? 'Génération…' : 'Générer maintenant'}
            onPress={() => generate.mutate()}
            disabled={generate.isPending}
          />

          {generate.data === undefined ? null : (
            <p className="mt-3 text-sm text-success-700">
              {generate.data.created} départ{generate.data.created > 1 ? 's' : ''} créé
              {generate.data.created > 1 ? 's' : ''} sur {generate.data.horizon_days} jours.
            </p>
          )}
          {generate.error ? <ErrorNote message={describeError(generate.error)} /> : null}
        </Card>
      )}

      {adding ? <RoutePanel onClose={() => setAdding(false)} /> : null}
      {scheduling === null ? null : (
        <SchedulePanel route={scheduling} onClose={() => setScheduling(null)} />
      )}
    </div>
  )
}

function RoutePanel({ onClose }: { onClose: () => void }) {
  const create = useCreateRoute()
  const stations = useStations()
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [duration, setDuration] = useState('')

  const rows = stations.data?.data ?? []

  return (
    <Panel title="Nouvel itinéraire" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()

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
        <Field label="Gare de départ">
          <select
            className={INPUT}
            required
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
          >
            <option value="">Choisir…</option>
            {rows.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name} — {station.city}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Gare d’arrivée">
          <select
            className={INPUT}
            required
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          >
            <option value="">Choisir…</option>
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
          label="Durée de référence en minutes (facultatif)"
          hint="Affichée au passager comme estimation. Elle n’engage pas l’heure d’arrivée."
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

        {create.error ? <ErrorNote message={describeError(create.error)} /> : null}

        <Button
          type="submit"
          label="Créer l’itinéraire"
          disabled={origin === '' || destination === '' || create.isPending}
        />
      </form>
    </Panel>
  )
}

function SchedulePanel({ route, onClose }: { route: AgencyRoute; onClose: () => void }) {
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
    <Panel
      title={`Horaire — ${route.origin.station} → ${route.destination.station}`}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()

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
        <Field label="Heure de départ">
          <input
            className={INPUT}
            type="time"
            required
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </Field>

        {/*
          Les jours en boutons plutôt qu'en liste à cocher : un horaire se lit
          d'un coup d'œil, et sept cases empilées prennent la moitié du panneau.
        */}
        <Field label="Jours de circulation">
          <div className="mt-1 flex gap-1">
            {DAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                aria-pressed={days.includes(day.value)}
                onClick={() =>
                  setDays((current) =>
                    current.includes(day.value)
                      ? current.filter((value) => value !== day.value)
                      : [...current, day.value].sort(),
                  )
                }
                className={
                  days.includes(day.value)
                    ? 'h-9 w-9 rounded-full bg-ink-700 text-sm font-semibold text-neutral-0'
                    : 'h-9 w-9 rounded-full bg-neutral-100 text-sm text-neutral-500'
                }
              >
                {day.short}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Véhicule">
          <select
            className={INPUT}
            required
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
          >
            <option value="">Choisir…</option>
            {(vehicles.data?.data ?? []).map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration} — {vehicle.capacity} places
              </option>
            ))}
          </select>
        </Field>

        <Field label="Chauffeur (facultatif)">
          <select
            className={INPUT}
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
          >
            <option value="">Non assigné</option>
            {(drivers.data?.data ?? []).map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.first_name} {driver.last_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Prix en FCFA">
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
          label="À partir du"
          hint="Les départs ne sont générés qu’à compter de cette date."
        >
          <input
            className={INPUT}
            type="date"
            required
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </Field>

        {create.error ? <ErrorNote message={describeError(create.error)} /> : null}

        <Button
          type="submit"
          label="Créer l’horaire"
          disabled={days.length === 0 || vehicleId === '' || price === '' || create.isPending}
        />
      </form>
    </Panel>
  )
}
