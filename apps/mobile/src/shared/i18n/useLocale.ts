import { useTranslation } from 'react-i18next'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@motoboy/shared'

/**
 * La langue courante, typée.
 *
 * **Une seule source.** Les composants lisaient auparavant la langue d'i18next
 * pour leurs textes *et* recevaient une `locale` en propriété pour formater
 * montants et heures : deux valeurs qui peuvent diverger, et qui l'ont fait —
 * l'interface s'affichait en anglais pendant que les montants se formataient en
 * français. Le prix d'une divergence pareille est un écran incohérent, pas une
 * erreur.
 */
export function useLocale(): Locale {
  const { i18n } = useTranslation()

  return isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
}
