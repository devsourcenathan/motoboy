import { useState } from 'react'
import { newIdempotencyKey } from '@motoboy/api-client'
import type { Locale, TripSummary } from '@motoboy/api-client/types'
import {
  bookingStatusLabels,
  colors,
  countdownTo,
  errorLabel,
  formatCountdown,
  formatDuration,
  formatMoney,
  formatTime,
  LOCALE_NAMES,
  resolveLocale,
  SUPPORTED_LOCALES,
} from '@motoboy/shared'
import { api } from './lib/api'

/**
 * Écran de vérification de la chaîne.
 *
 * Il ne fait pas partie du produit : il existe pour prouver que le contrat
 * OpenAPI, les types générés et le package partagé traversent bien jusqu'à
 * l'application, dans les deux langues. À remplacer par le vrai routage.
 */
export default function App() {
  const [locale, setLocale] = useState<Locale>(() => resolveLocale(navigator.language))
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
      setError(errorLabel(err.code, locale))
      return
    }

    setError(null)
    setTrips(data.data)
  }

  const hold = countdownTo(new Date(Date.now() + 9 * 60_000).toISOString())

  return (
    <main style={{ fontFamily: 'system-ui', padding: 32, maxWidth: 720 }}>
      <h1 style={{ color: colors.brand[600] }}>MOTOBOY</h1>

      <div>
        {SUPPORTED_LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            disabled={code === locale}
          >
            {LOCALE_NAMES[code]}
          </button>
        ))}
      </div>

      <p>
        {bookingStatusLabels[locale].PENDING_PAYMENT} —{' '}
        <strong>{formatCountdown(hold)}</strong>
      </p>

      <button type="button" onClick={search}>
        {newIdempotencyKey().slice(0, 8)}
      </button>

      {error && <p style={{ color: colors.status.danger }}>{error}</p>}

      <ul>
        {trips.map((trip) => (
          <li key={trip.reference}>
            {formatTime(trip.departure_at, { locale })} — {trip.agency.name} —{' '}
            {formatMoney(trip.price, locale)}
            {trip.duration_minutes != null &&
              ` — ${formatDuration(trip.duration_minutes, locale)}`}
          </li>
        ))}
      </ul>
    </main>
  )
}
