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
export * from './messages.js'
export * from './tokens.js'
