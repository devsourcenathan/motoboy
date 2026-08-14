import { StyleSheet } from 'react-native'
import { colors, fontSize, lineHeight, radius, spacing } from '@motoboy/shared'

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
export { colors, fontSize, lineHeight, radius, spacing }

export const theme = {
  text: {
    primary: colors.neutral[900],
    secondary: colors.neutral[700],
    muted: colors.neutral[500],
    inverse: colors.neutral[0],
    brand: colors.brand[600],
    /** Titres de section, en capitales — « TRAJETS À VENIR ». */
    accent: colors.accent[700],
    danger: colors.status.danger,
    onDangerSoft: colors.status.onDangerSoft,
  },
  surface: {
    page: colors.page,
    /** Cartes : blanc pur sur le lavande de la page. */
    card: colors.neutral[0],
    /** Bandeau d'en-tête de carte, ligne encastrée date/heure. */
    raised: colors.neutral[50],
    sunken: colors.neutral[100],
    /** Éléments inertes : place occupée, bouton désactivé, puce terminée. */
    inert: colors.neutral[200],
    border: colors.neutral[300],
    brand: colors.brand[600],
    brandSoft: colors.brand[50],
    accent: colors.accent[300],
    accentSoft: colors.accent[100],
    dangerSoft: colors.status.dangerSoft,
  },
  seat: {
    available: colors.status.available,
    held: colors.status.held,
    taken: colors.status.taken,
    chosen: colors.brand[600],
  },
  /**
   * Repères d'un trajet.
   *
   * Or au départ, bleu à l'arrivée — la même paire sur la carte de résultat, le
   * billet et la liste. C'est ce qui permet de lire un trajet sans lire les
   * libellés, ce qui compte quand on regarde son téléphone en marchant.
   */
  route: {
    origin: colors.accent[500],
    destination: colors.brand[600],
  },
} as const

/**
 * Hauteur minimale des cibles tactiles.
 *
 * Le produit s'utilise debout, en gare, souvent d'une main et parfois sous le
 * soleil : une cible plus petite se rate, et un passager qui rate son bouton
 * trois fois abandonne. 48 dp est le plancher recommandé par les deux
 * plateformes, et le système de design le reprend explicitement.
 */
export const TOUCH_TARGET = 48

/**
 * Élévation de niveau 1 : carte posée sur la page.
 *
 * Ombre très diffuse plutôt que marquée — le fond lavande fait déjà ressortir
 * le blanc, et une ombre appuyée sur une dalle bon marché devient une bande
 * grise.
 */
export const elevation = {
  card: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  floating: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const

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
  /** Carte de niveau 1 — blanc, bordure fine, ombre diffuse. */
  card: {
    backgroundColor: theme.surface.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: theme.surface.border,
    ...elevation.card,
  },
  /** Titre de section en capitales, or. */
  sectionLabel: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.text.accent,
  },
})
