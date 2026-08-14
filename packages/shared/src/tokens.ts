/**
 * Jetons de design.
 *
 * Seuls les **jetons** se partagent entre web et mobile, jamais les
 * composants : shadcn repose sur Radix et le DOM (§6 du brief). Le web les
 * consomme via la configuration Tailwind, le mobile via ses propres
 * primitives de style.
 *
 * Les valeurs viennent du système *Motoboy Design System*
 * (`stitch_motoboy_mobility_platform/motoboy_design_system/DESIGN.md`) et des
 * écrans qui l'accompagnent. **En cas de désaccord entre les deux, l'écran
 * l'emporte** : le document annonce un bouton primaire or, les maquettes le
 * montrent bleu et l'or réservé aux actions secondaires, aux repères d'origine
 * et aux titres de section. C'est l'écran qui a été validé.
 */

export const colors = {
  /**
   * Bleu électrique profond — technologie, loyauté, sécurité.
   *
   * Porte les CTA, le mot-symbole, les prix et la place choisie. `600` est la
   * teinte dominante ; `700` sert aux aplats les plus sombres.
   */
  brand: {
    50: '#e0e0ff',
    100: '#bfc2ff',
    500: '#2b30bb',
    600: '#0f0fa9',
    700: '#020075',
  },
  /**
   * Or solaire — visibilité en plein soleil, énergie du mouvement.
   *
   * Jamais sur un CTA principal : il marque l'origine d'un trajet, les titres
   * de section, les puces de statut et le contour des actions secondaires.
   */
  accent: {
    100: '#ffe089',
    300: '#fecf30',
    500: '#e9bc17',
    700: '#745b00',
    900: '#574400',
  },
  neutral: {
    /** Cartes et feuilles — le niveau 1 du système d'élévation. */
    0: '#ffffff',
    /** Bandeaux d'en-tête de carte, lignes encastrées. */
    50: '#f5f2fe',
    100: '#efecf8',
    /** Places occupées, puces inactives, boutons désactivés. */
    200: '#e4e1ed',
    /** Bordures. */
    300: '#c6c5d7',
    500: '#767686',
    700: '#454554',
    900: '#1b1b23',
  },
  /**
   * Fond de page.
   *
   * Lavande très clair plutôt que blanc pur : il fait ressortir les cartes
   * blanches sans ombre appuyée, ce qui tient mieux sur les dalles bon marché
   * où une ombre légère disparaît.
   */
  page: '#fbf8ff',
  /** États métier — repris tels quels dans les deux clients. */
  status: {
    /** Place libre : contour, pas aplat. Un aplat vert ferait un damier. */
    available: '#c6c5d7',
    held: '#e9bc17',
    taken: '#e4e1ed',
    success: '#0f0fa9',
    danger: '#ba1a1a',
    dangerSoft: '#ffdad6',
    onDangerSoft: '#93000a',
  },
} as const

/** Grille de base de 8 px. `sm` vaut 12 : c'est la gouttière du système. */
export const spacing = {
  xs: 4,
  base: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  /** Boutons principaux — capsules, pour se distinguer des cartes. */
  pill: 24,
  full: 9999,
} as const

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
} as const

/**
 * Hauteurs de ligne, en points et non en multiplicateurs.
 *
 * React Native attend un nombre absolu ; laisser le défaut donne un interligne
 * serré qui se voit surtout sur les titres longs — « Où allez-vous
 * aujourd'hui ? » passe sur deux lignes dans les deux langues.
 */
export const lineHeight = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 28,
  xl: 32,
  '2xl': 36,
  '3xl': 40,
} as const

export type ColorScale = typeof colors
export type Spacing = keyof typeof spacing
