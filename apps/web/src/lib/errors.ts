import { ApiError, NetworkError } from '@motoboy/api-client'
import { errorLabel, resolveLocale } from '@motoboy/shared'
import { i18next } from './i18n'

/**
 * Le texte visible d'une erreur.
 *
 * **La langue est lue à chaque appel, pas au chargement du module.** Elle l'était
 * — `resolveLocale(navigator.language)` évalué une fois — ce qui rendait les
 * erreurs sourdes au sélecteur de langue : un agent qui bascule en anglais
 * continuait de lire ses refus de paiement en français, et rien à l'écran ne
 * reliait les deux. Le défaut ne se voyait pas tant qu'aucune erreur ne
 * survenait.
 *
 * Le `message` de l'API n'est jamais affiché : c'est un **diagnostic**, destiné
 * aux journaux, et sa langue n'est pas garantie ([I10]). Le texte visible se
 * compose ici depuis le `code` typé.
 */
function locale() {
  return resolveLocale(i18next.language)
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return errorLabel(error.code, locale())

  // Deux formulations qui n'ont pas de code : elles viennent du transport, pas
  // de l'API, et vivent donc dans le catalogue commun plutôt qu'en dur ici.
  if (error instanceof NetworkError) return i18next.t('common:state.offline')

  if (import.meta.env.DEV) {
    const detail =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)

    return `${i18next.t('common:state.unexpected')}\n[dev] ${detail}`
  }

  return i18next.t('common:state.unexpected')
}
