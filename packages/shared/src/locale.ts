import type { Locale } from '@motoboy/api-client/types'

export type { Locale }

/**
 * Français et anglais dès le lancement.
 *
 * Le Cameroun a deux langues officielles, et les régions du Nord-Ouest et du
 * Sud-Ouest sont anglophones — Bamenda, Buea et Limbe sont des destinations
 * interurbaines réelles. L'anglais n'est donc pas un sujet d'expansion
 * internationale : c'est une partie du marché de lancement.
 */
export const SUPPORTED_LOCALES = ['fr', 'en'] as const satisfies readonly Locale[]

export const DEFAULT_LOCALE: Locale = 'fr'

/** Étiquettes BCP-47 pour `Intl`. */
export const INTL_LOCALES: Record<Locale, string> = {
  fr: 'fr-CM',
  en: 'en-CM',
}

/** Noms des langues, dans leur propre langue — pour un sélecteur. */
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
}

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
  )
}

/**
 * Ramène une préférence système — `navigator.language`, réglages du téléphone —
 * vers une langue servie. Tout ce qui n'est pas reconnu retombe sur le défaut.
 */
export function resolveLocale(preferred: string | null | undefined): Locale {
  if (!preferred) return DEFAULT_LOCALE
  const base = preferred.toLowerCase().split('-')[0]
  return isLocale(base) ? base : DEFAULT_LOCALE
}
