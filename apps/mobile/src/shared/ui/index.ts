/**
 * Primitives d'interface du mobile.
 *
 * Un point d'entrée unique pour que les écrans importent `../shared/ui` sans
 * connaître le découpage interne : déplacer un composant ne doit pas obliger à
 * toucher tous ses appelants.
 */
export * from './Button'
export * from './Field'
export * from './Screen'
export * from './theme'
