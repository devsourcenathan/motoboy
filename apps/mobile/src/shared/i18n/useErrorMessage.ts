import { useTranslation } from 'react-i18next'
import { ApiError, NetworkError } from '@motoboy/api-client'
import { errorLabel } from '@motoboy/shared'
import { useLocale } from './useLocale'
import { API_BASE_URL } from '../api/client'

/**
 * Traduit une erreur en message affichable.
 *
 * **Une seule règle, partagée.** Elle était recopiée dans chaque écran, et
 * c'était une copie au sens dangereux du terme : le jour où l'on ajoute un cas
 * — une erreur de version d'API, un blocage réseau distinct — il faudrait le
 * retrouver à quatre endroits, et le troisième serait oublié.
 *
 * Trois cas, et l'ordre compte :
 *
 * 1. **`ApiError`** — le serveur a répondu et refusé. Le texte vient du `code`,
 *    jamais du `message` : celui-ci est un diagnostic pour les journaux, dont la
 *    langue n'est pas garantie (I10).
 * 2. **`NetworkError`** — la requête n'a jamais abouti. En gare routière c'est
 *    fréquent, et cela appelle la réaction inverse : réessayer, plutôt que
 *    corriger sa demande.
 * 3. Le reste — une panne du client, qu'on ne déguise pas en problème métier.
 */
export function useErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation()
  const locale = useLocale()

  return (error: unknown) => {
    if (error instanceof ApiError) return errorLabel(error.code, locale)

    if (error instanceof NetworkError) {
      /*
       * **L'adresse appelée, en développement.**
       *
       * « Pas de connexion » accuse le réseau, alors que la cause est presque
       * toujours l'adresse : une IP figée dans le paquet et devenue fausse, ou
       * une adresse de bouclage déduite d'un Metro en mode localhost. Sans elle
       * affichée, on ne peut pas distinguer les deux depuis l'appareil — et il
       * n'y a pas de console à portée.
       */
      if (__DEV__) {
        const cause = error.cause instanceof Error ? error.cause.message : ''

        return `${t('state.offline', { ns: 'common' })}\n[dev] ${API_BASE_URL}${
          cause === '' ? '' : `\n[dev] ${cause}`
        }`
      }

      return t('state.offline', { ns: 'common' })
    }

    /*
     * **La branche de repli disait « une erreur inattendue » et rien d'autre.**
     *
     * C'est exactement la panne qu'on ne peut pas diagnostiquer : le message est
     * correct pour l'utilisateur, et muet pour qui doit la corriger. Sur un
     * téléphone il n'y a pas de console à portée, et j'ai perdu une heure à
     * deviner ce que cette phrase cachait.
     *
     * En développement, la cause s'affiche donc à l'écran. En production, le
     * message reste celui de l'utilisateur : lui montrer un nom de classe ne
     * l'aide pas et le message d'origine n'est pas garanti dans sa langue.
     */
    if (__DEV__) {
      const name = error instanceof Error ? error.name : typeof error
      const detail = error instanceof Error ? error.message : String(error)

      return `${t('state.unexpected', { ns: 'common' })}\n[dev] ${name}: ${detail}`
    }

    return t('state.unexpected', { ns: 'common' })
  }
}
