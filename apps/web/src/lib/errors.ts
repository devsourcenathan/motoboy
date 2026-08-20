import { ApiError, NetworkError } from '@motoboy/api-client'
import { errorLabel, resolveLocale } from '@motoboy/shared'

/**
 * Traduit une erreur en message affichable.
 *
 * Même règle et même ordre que côté mobile — le texte vient du `code`, jamais
 * du `message`, qui est un diagnostic pour les journaux et dont la langue n'est
 * pas garantie (I10).
 *
 * Une fonction et non un hook : le back-office n'a pas de sélecteur de langue,
 * la locale se déduit du navigateur une fois pour toutes.
 */
const locale = resolveLocale(navigator.language)

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return errorLabel(error.code, locale)
  if (error instanceof NetworkError) return 'Pas de connexion à l’API.'

  /*
   * En développement, la cause s'affiche : « une erreur inattendue » est
   * correct pour l'utilisateur et muet pour qui doit la corriger. La leçon
   * vient du mobile, où cette phrase seule a coûté une heure de recherche.
   */
  if (import.meta.env.DEV) {
    const detail =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)

    return `Une erreur inattendue est survenue.\n[dev] ${detail}`
  }

  return 'Une erreur inattendue est survenue.'
}
