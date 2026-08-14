import dayjs from 'dayjs'
import 'dayjs/locale/fr.js'
import 'dayjs/locale/en.js'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import type { Locale } from '@motoboy/api-client/types'
import { DEFAULT_LOCALE } from './locale.js'

dayjs.extend(utc)
dayjs.extend(timezone)

/*
 * La langue n'est **jamais** posée globalement sur dayjs. Un `dayjs.locale()`
 * au chargement du module fixerait la langue du processus entier, alors que le
 * web sert deux langues simultanément et que le contenu généré côté serveur
 * dépend du destinataire, pas de l'application.
 */

/** Fuseau de la zone de lancement. Portée par `countries.timezone` à terme. */
export const DEFAULT_TIMEZONE = 'Africa/Douala'

export interface FormatOptions {
  locale?: Locale
  timezone?: string
}

function at(iso: string, options: FormatOptions = {}) {
  return dayjs(iso)
    .tz(options.timezone ?? DEFAULT_TIMEZONE)
    .locale(options.locale ?? DEFAULT_LOCALE)
}

/*
 * Le motif de date est le même dans les deux langues — l'anglais camerounais
 * suit l'usage britannique, « 14 August 2026 » et non « August 14, 2026 ». Le
 * nom du mois est traduit par dayjs. Seul le mot de liaison diffère.
 */
const DATE_PATTERN = 'D MMMM YYYY'

const DATE_TIME_PATTERNS: Record<Locale, string> = {
  fr: 'D MMM YYYY [à] HH:mm',
  en: 'D MMM YYYY [at] HH:mm',
}

export function formatTime(iso: string, options: FormatOptions = {}): string {
  return at(iso, options).format('HH:mm')
}

export function formatDate(iso: string, options: FormatOptions = {}): string {
  return at(iso, options).format(DATE_PATTERN)
}

export function formatDateTime(iso: string, options: FormatOptions = {}): string {
  return at(iso, options).format(DATE_TIME_PATTERNS[options.locale ?? DEFAULT_LOCALE])
}

/** `2 h 30` et `45 min` en français, `2h 30m` et `45m` en anglais. */
export function formatDuration(minutes: number, locale: Locale = DEFAULT_LOCALE): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (locale === 'en') {
    if (hours === 0) return `${rest}m`
    if (rest === 0) return `${hours}h`
    return `${hours}h ${rest}m`
  }

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
