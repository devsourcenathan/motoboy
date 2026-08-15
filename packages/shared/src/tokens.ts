/**
 * Jetons de design.
 *
 * Seuls les **jetons** se partagent entre web et mobile, jamais les
 * composants : shadcn repose sur Radix et le DOM (§6 du brief). Le web les
 * consomme via la configuration Tailwind, le mobile via ses propres
 * primitives de style.
 *
 * Les valeurs viennent des maquettes de `design/`. Orange pour agir, marine
 * pour l'identité, vert pour ce qui est acquis : trois rôles distincts, jamais
 * interchangeables. C'est ce qui permet de savoir où appuyer sans lire.
 */

export const colors = {
  /**
   * Orange — **la couleur de l'action, et d'elle seule.**
   *
   * Tout ce qui fait avancer le parcours la porte : rechercher, continuer,
   * payer. Elle marque aussi les prix et la place choisie. Ne jamais la poser
   * sur un élément qui ne se presse pas — c'est le repère qui rend l'écran
   * lisible d'un coup d'œil en gare.
   */
  brand: {
    50: '#fff1e8',
    100: '#ffd9c0',
    500: '#f4661b',
    600: '#e05610',
    700: '#b6430a',
  },
  /**
   * Marine — l'identité, les en-têtes, les actions secondaires pleines.
   *
   * Elle porte le bandeau d'accueil et le haut du billet : les deux endroits où
   * la marque doit se voir sans crier.
   */
  ink: {
    50: '#eef2f7',
    500: '#1d4b73',
    700: '#10314f',
    900: '#0a2138',
  },
  /**
   * Vert — ce qui est **acquis** : places disponibles, paiement réussi,
   * réservation confirmée. Jamais une action à faire.
   */
  success: {
    50: '#e8f7ef',
    500: '#22a45d',
    700: '#177a44',
  },
  neutral: {
    /** Cartes et feuilles. */
    0: '#ffffff',
    /** Lignes encastrées, bandeaux d'en-tête de carte. */
    50: '#f7f8fa',
    100: '#f1f3f6',
    /** Éléments inertes : place occupée, bouton désactivé. */
    200: '#e5e7eb',
    /** Bordures. */
    300: '#d7dbe0',
    500: '#8b93a1',
    700: '#4b5563',
    900: '#1a1d21',
  },
  /** Fond de page — gris très clair, pour que les cartes blanches ressortent. */
  page: '#f5f6f8',
  /** États métier — repris tels quels dans les deux clients. */
  status: {
    /** Place libre : vert tendre, comme la légende du plan de sièges. */
    available: '#22a45d',
    availableSoft: '#e8f7ef',
    held: '#f4661b',
    taken: '#e5e7eb',
    danger: '#d1443c',
    dangerSoft: '#fdeceb',
    onDangerSoft: '#8f2820',
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
  /** Boutons principaux — coins francs mais nets, pas des capsules. */
  pill: 12,
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
 * serré qui se voit surtout sur les titres longs — « Où souhaitez-vous aller
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
