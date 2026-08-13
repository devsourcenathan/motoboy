import dayjs from 'dayjs'
import 'dayjs/locale/fr.js'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('fr')

/** Fuseau de la zone de lancement. Portée par `countries.timezone` à terme. */
export const DEFAULT_TIMEZONE = 'Africa/Douala'

export function formatTime(iso: string, tz = DEFAULT_TIMEZONE): string {
  return dayjs(iso).tz(tz).format('HH:mm')
}

export function formatDate(iso: string, tz = DEFAULT_TIMEZONE): string {
  return dayjs(iso).tz(tz).format('D MMMM YYYY')
}

export function formatDateTime(iso: string, tz = DEFAULT_TIMEZONE): string {
  return dayjs(iso).tz(tz).format('D MMM YYYY [à] HH:mm')
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} h`
  return `${hours} h ${String(rest).padStart(2, '0')}`
}

export interface Countdown {
  totalSeconds: number
  minutes: number
  seconds: number
  expired: boolean
}

/**
 * Reste à courir sur la tenue des places.
 *
 * Purement **affichage** : l'expiration fait foi côté backend, qui reste la
 * source de vérité sur le statut d'une réservation (§29 du brief). Un client
 * qui verrait `expired: true` doit redemander l'état au serveur, jamais
 * conclure seul que les places sont perdues.
 *
 * `now` est injectable pour rendre la fonction testable.
 */
export function countdownTo(expiresAt: string, now: Date = new Date()): Countdown {
  const totalSeconds = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000),
  )

  return {
    totalSeconds,
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
    expired: totalSeconds === 0,
  }
}

export function formatCountdown(countdown: Countdown): string {
  return `${countdown.minutes}:${String(countdown.seconds).padStart(2, '0')}`
}
