/**
 * `@motoboy/shared` — domaine sans interface, partagé entre web et mobile.
 *
 * **Ce package ne porte jamais de règle métier.** Le backend est la source de
 * vérité pour la disponibilité, le prix final, le statut d'une réservation et
 * la validité d'un billet (§29 du brief). On y trouve du formatage, des
 * libellés et des jetons — le jour où l'on y recalcule des frais
 * d'annulation, la règle existe en deux exemplaires et elles divergeront.
 *
 * **Aucune dépendance DOM ni React Native.** TypeScript et dayjs, rien
 * d'autre. `node-linker=hoisted` étant nécessaire à Metro, le résolveur ne
 * fait plus respecter cette règle : elle est vérifiée en CI.
 */

export * from './locale.js'
export * from './money.js'
export * from './datetime.js'
export * from './labels.js'
export * from './tokens.js'
export * from './brand.js'
export * from './phone.js'

/*
 * Les catalogues de traduction ne sont **pas** réexportés ici.
 *
 * Ils vivent dans `src/i18n/` et s'importent par point d'entrée dédié —
 * `@motoboy/shared/i18n/passenger`, `@motoboy/shared/i18n/common`. Les faire
 * passer par cet index les ferait entrer dans **tous** les bundles : Metro ne
 * secoue pas l'arbre, et le mobile embarquerait les textes du back-office
 * d'agence.
 *
 * Ils restent dans ce package malgré tout : un traducteur ne doit pas les
 * chercher à deux endroits, et le ton du produit se tient d'un seul.
 */
