/**
 * Jetons de design.
 *
 * Seuls les **jetons** se partagent entre web et mobile, jamais les
 * composants : shadcn repose sur Radix et le DOM (§6 du brief). Le web les
 * consomme via la configuration Tailwind, le mobile via ses propres
 * primitives de style.
 */

export const colors = {
  brand: {
    50: '#eef7ff',
    100: '#d9ecff',
    500: '#1f7ae0',
    600: '#1662bb',
    700: '#124e96',
  },
  neutral: {
    0: '#ffffff',
    50: '#f7f8fa',
    100: '#eceef2',
    300: '#c6cbd4',
    500: '#7b8494',
    700: '#414956',
    900: '#181c23',
  },
  /** États métier — repris tels quels dans les deux clients. */
  status: {
    available: '#1a9e5c',
    held: '#e0a02a',
    taken: '#b4b9c2',
    danger: '#d1453b',
  },
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
} as const

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
} as const

export type ColorScale = typeof colors
export type Spacing = keyof typeof spacing
