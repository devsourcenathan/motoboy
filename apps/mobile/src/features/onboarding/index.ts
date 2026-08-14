/**
 * Onboarding — présentation du produit au premier lancement.
 *
 * La route ne fait que rendre cet écran : `app/` porte l'aiguillage, les
 * fonctionnalités portent leur implémentation. Sans cette séparation, changer
 * de routeur reviendrait à réécrire les écrans.
 */
export { Onboarding } from './ui/Onboarding'
export { hasSeenOnboarding, markOnboardingSeen } from './model/storage'
