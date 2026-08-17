/**
 * Le chauffeur indépendant (C1 à C7).
 *
 * **Pas une seconde application.** Un chauffeur reste un passager quand il
 * voyage : il garde ses onglets, et bascule vers ce parcours depuis son profil.
 * Deux applications l'obligeraient à choisir un rôle à l'installation, alors que
 * le même téléphone sert aux deux.
 *
 * Ses revenus et son compte de reversement vivent sur un seul écran : c'est la
 * seule action que cet argent appelle, et la seule chose qui, non faite, empêche
 * tout virement.
 */
export { DriverHomeScreen } from './ui/DriverHomeScreen'
export { DriverApplicationScreen } from './ui/DriverApplicationScreen'
export { OpenRequestsScreen } from './ui/OpenRequestsScreen'
export { DriverRidesScreen } from './ui/DriverRidesScreen'
export { DriverEarningsScreen } from './ui/DriverEarningsScreen'
