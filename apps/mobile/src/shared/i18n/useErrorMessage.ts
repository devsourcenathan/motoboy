import { useTranslation } from 'react-i18next'
import { ApiError, NetworkError } from '@motoboy/api-client'
import { errorLabel } from '@motoboy/shared'
import { useLocale } from './useLocale'

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
    if (error instanceof NetworkError) return t('state.offline', { ns: 'common' })

    return t('state.unexpected', { ns: 'common' })
  }
}
