import { StyleSheet } from 'react-native'
import { colors, fontSize, radius, spacing } from '@motoboy/shared'

/**
 * Le thème du mobile.
 *
 * **Construit sur les jetons partagés, jamais à côté.** Seuls les jetons se
 * partagent entre web et mobile — shadcn repose sur Radix et le DOM. Redéclarer
 * ici une couleur de marque ferait diverger les deux clients au premier
 * ajustement de charte.
 *
 * Aucun kit d'interface tiers : ils imposent leur propre système de thème,
 * qu'il faudrait combattre à chaque écran pour revenir à ces jetons.
 */
export { colors, fontSize, radius, spacing }

export const theme = {
  text: {
    primary: colors.neutral[900],
    secondary: colors.neutral[700],
    muted: colors.neutral[500],
    inverse: colors.neutral[0],
    brand: colors.brand[600],
    danger: colors.status.danger,
  },
  surface: {
    page: colors.neutral[0],
    raised: colors.neutral[50],
    border: colors.neutral[100],
    brand: colors.brand[600],
    brandSoft: colors.brand[50],
  },
  seat: {
    available: colors.status.available,
    held: colors.status.held,
    taken: colors.status.taken,
  },
} as const

/**
 * Hauteur minimale des cibles tactiles.
 *
 * Le produit s'utilise debout, en gare, souvent d'une main et parfois sous le
 * soleil : une cible plus petite se rate, et un passager qui rate son bouton
 * trois fois abandonne. 48 dp est le plancher recommandé par les deux
 * plateformes.
 */
export const TOUCH_TARGET = 48

export const sharedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.surface.page,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
})
