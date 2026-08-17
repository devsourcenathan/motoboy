/**
 * Le chauffeur indépendant (C1 à C7).
 *
 * **Pas une seconde application.** Un chauffeur reste un passager quand il
 * voyage : il garde ses onglets, et bascule vers ce parcours depuis son profil.
 * Deux applications l'obligeraient à choisir un rôle à l'installation, alors que
 * le même téléphone sert aux deux.
 *
 * Ce que cette tranche ne couvre pas encore : ses revenus et son compte de
 * reversement (C8, C9). L'API n'expose rien pour un chauffeur — les
 * grands livres et comptes de versement existent, mais sous `agency/`. Construire
 * l'écran sans l'endpoint reviendrait à inventer un solde.
 */
export { DriverHomeScreen } from './ui/DriverHomeScreen'
export { DriverApplicationScreen } from './ui/DriverApplicationScreen'
export { OpenRequestsScreen } from './ui/OpenRequestsScreen'
export { DriverRidesScreen } from './ui/DriverRidesScreen'
