import { useState } from 'react'
import { newIdempotencyKey } from '@motoboy/api-client'
import type { TripSummary } from '@motoboy/api-client/types'
import {
  bookingStatusLabels,
  colors,
  countdownTo,
  errorCodeLabels,
  formatCountdown,
  formatDuration,
  formatMoney,
  formatTime,
} from '@motoboy/shared'
import { api } from './lib/api'

/**
 * Écran de vérification de la chaîne.
 *
 * Il ne fait pas partie du produit : il existe pour prouver que le contrat
 * OpenAPI, les types générés et le package partagé traversent bien jusqu'à
 * l'application. À remplacer par le vrai routage.
 */
export default function App() {
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  async function search() {
    const { data, error: err } = await api.GET('/v1/search', {
      params: {
        query: {
          origin_city_id: 1,
          destination_city_id: 2,
          date: '2026-08-14',
          passengers: 1,
        },
      },
    })

    if (err) {
      setError(errorCodeLabels[err.code])
      return
    }

    setError(null)
    setTrips(data.data)
  }

  const hold = countdownTo(new Date(Date.now() + 9 * 60_000).toISOString())

  return (
    <main style={{ fontFamily: 'system-ui', padding: 32, maxWidth: 720 }}>
      <h1 style={{ color: colors.brand[600] }}>MOTOBOY</h1>

      <p>
        Statut d&apos;exemple : {bookingStatusLabels.PENDING_PAYMENT} — il reste{' '}
        <strong>{formatCountdown(hold)}</strong>
      </p>

      <button type="button" onClick={search}>
        Rechercher (clé {newIdempotencyKey().slice(0, 8)}…)
      </button>

      {error && <p style={{ color: colors.status.danger }}>{error}</p>}

      <ul>
        {trips.map((trip) => (
          <li key={trip.reference}>
            {formatTime(trip.departure_at)} — {trip.agency.name} —{' '}
            {formatMoney(trip.price)}
            {trip.duration_minutes != null && ` — ${formatDuration(trip.duration_minutes)}`}
          </li>
        ))}
      </ul>
    </main>
  )
}
