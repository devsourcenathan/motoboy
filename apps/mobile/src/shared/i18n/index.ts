import { getLocales } from 'expo-localization'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  DEFAULT_LOCALE,
  resolveLocale,
  SUPPORTED_LOCALES,
  type Locale,
} from '@motoboy/shared'
import { commonMessages } from '@motoboy/shared/i18n/common'
import { passengerMessages } from '@motoboy/shared/i18n/passenger'

/**
 * Deux espaces de noms, deux catalogues.
 *
 * `common` — ce qu'un passager et un agent lisent à l'identique. `screens` —
 * le parcours passager. Les deux vivent dans `@motoboy/shared`, importés par
 * **point d'entrée dédié** : les faire passer par l'index du package
 * embarquerait aussi les textes du back-office, que Metro ne sait pas élaguer.
 *
 * Les garder séparés rend visible, à la lecture d'un composant, ce qui est
 * partagé et ce qui ne l'est pas.
 */
const NAMESPACES = { common: 'common', screens: 'screens' } as const

const resources = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [
    locale,
    {
      [NAMESPACES.common]: commonMessages[locale],
      [NAMESPACES.screens]: passengerMessages[locale],
    },
  ]),
)

/**
 * La langue du téléphone sert de valeur initiale.
 *
 * Une fois le compte créé, `users.locale` fait foi : c'est elle qui détermine
 * la langue des SMS, et un passager qui lit l'application en français ne doit
 * pas recevoir ses billets en anglais (I10).
 */
export function deviceLocale(): Locale {
  return resolveLocale(getLocales()[0]?.languageCode)
}

void i18next.use(initReactI18next).init({
  resources,
  lng: deviceLocale(),
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: NAMESPACES.screens,
  ns: [NAMESPACES.screens, NAMESPACES.common],
  interpolation: {
    // React échappe déjà ce qu'il rend ; le faire deux fois transforme une
    // apostrophe en `&#39;` à l'écran, et le français en est plein.
    escapeValue: false,
  },
  returnObjects: true,
})

export function setLocale(locale: Locale): void {
  void i18next.changeLanguage(locale)
}

export { i18next, NAMESPACES }
