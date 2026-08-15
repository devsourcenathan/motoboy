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
    /** Orange : les actions et les prix, rien d'autre. */
    brand: colors.brand[500],
    /** Marine : l'identité et les titres de section. */
    ink: colors.ink[700],
    /** Vert : ce qui est acquis — places libres, paiement abouti. */
    success: colors.success[700],
    danger: colors.status.danger,
    onDangerSoft: colors.status.onDangerSoft,
  },
  surface: {
    page: colors.page,
    card: colors.neutral[0],
    /** Bandeau d'en-tête de carte, ligne encastrée date/heure. */
    raised: colors.neutral[50],
    sunken: colors.neutral[100],
    /** Éléments inertes : place occupée, bouton désactivé, puce terminée. */
    inert: colors.neutral[200],
    border: colors.neutral[300],
    brand: colors.brand[500],
    brandSoft: colors.brand[50],
    ink: colors.ink[700],
    inkSoft: colors.ink[50],
    success: colors.success[500],
    successSoft: colors.success[50],
    dangerSoft: colors.status.dangerSoft,
  },
  seat: {
    available: colors.status.available,
    availableSoft: colors.status.availableSoft,
    held: colors.status.held,
    taken: colors.status.taken,
    chosen: colors.brand[500],
  },
  /**
   * Repères d'un trajet.
   *
   * La même paire sur la carte de résultat, le billet et la liste : c'est ce
   * qui permet de lire un trajet sans lire les libellés, ce qui compte quand on
   * regarde son téléphone en marchant.
   */
  route: {
    origin: colors.brand[500],
    destination: colors.ink[700],
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
  /** Titre de section, en capitales. */
  sectionLabel: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.text.muted,
  },
})
