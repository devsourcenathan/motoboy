import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  DEFAULT_LOCALE,
  resolveLocale,
  SUPPORTED_LOCALES,
  type Locale,
} from '@motoboy/shared'
import { agencyMessages } from '@motoboy/shared/i18n/agency'
import { boardingMessages } from '@motoboy/shared/i18n/boarding'
import { commonMessages } from '@motoboy/shared/i18n/common'
import { publicMessages } from '@motoboy/shared/i18n/public'

/**
 * Les langues du web.
 *
 * Quatre espaces de noms, quatre catalogues, comme sur le mobile : `common` pour ce
 * qui se lit à l'identique partout, `public` pour le comparateur, `boarding` pour
 * le quai, `agency` pour le bureau. Chacun s'importe par son point d'entrée dédié — les faire passer par
 * l'index du package embarquerait aussi les textes du parcours passager mobile.
 *
 * **L'administration n'y figure pas, et c'est une décision du brief** ([I10]) :
 * français seul, usage interne. Traduire un back-office que seule l'équipe ouvre
 * coûterait deux cents chaînes pour personne.
 */
const NAMESPACES = {
  common: 'common',
  public: 'public',
  boarding: 'boarding',
  agency: 'agency',
} as const

const resources = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [
    locale,
    {
      [NAMESPACES.common]: commonMessages[locale],
      [NAMESPACES.public]: publicMessages[locale],
      [NAMESPACES.boarding]: boardingMessages[locale],
      [NAMESPACES.agency]: agencyMessages[locale],
    },
  ]),
)

const STORAGE_KEY = 'motoboy.locale'

/**
 * La langue choisie, ou celle du navigateur.
 *
 * **Elle doit survivre au rechargement, et c'est ce qui distingue le web du
 * mobile.** L'application garde son état ; un navigateur repart de zéro à chaque
 * F5. Un agent anglophone qui bascule l'embarquement en anglais, puis recharge la
 * page — ce que fait précisément quelqu'un dont l'écran s'est figé —, la
 * retrouverait en français sans comprendre ce qu'il a fait de travers.
 *
 * `localStorage` peut lever : navigation privée sur certains navigateurs, ou
 * stockage désactivé. On retombe alors sur la langue du navigateur plutôt que de
 * faire échouer le démarrage de l'application pour une préférence d'affichage.
 */
function storedLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    return stored !== null && (SUPPORTED_LOCALES as readonly string[]).includes(stored)
      ? (stored as Locale)
      : null
  } catch {
    return null
  }
}

export function initialLocale(): Locale {
  return storedLocale() ?? resolveLocale(navigator.language)
}

void i18next.use(initReactI18next).init({
  resources,
  lng: initialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: NAMESPACES.common,
  ns: [NAMESPACES.common, NAMESPACES.public, NAMESPACES.boarding, NAMESPACES.agency],
  interpolation: {
    // React échappe déjà ce qu'il rend ; le faire deux fois transforme une
    // apostrophe en `&#39;` à l'écran, et le français en est plein.
    escapeValue: false,
  },
  returnObjects: true,
})

export function setLocale(locale: Locale): void {
  void i18next.changeLanguage(locale)

  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Le choix vaut alors pour la session seulement. Mieux que rien, et bien
    // mieux qu'une exception au moment de changer de langue.
  }

  /*
   * `lang` sur la racine du document, parce que ce n'est pas décoratif : c'est
   * ce qui fait lire la page avec le bon accent par un lecteur d'écran, et ce
   * sur quoi le navigateur s'appuie pour la césure et la correction
   * orthographique dans les champs.
   */
  document.documentElement.lang = locale
}

export { i18next, NAMESPACES }
