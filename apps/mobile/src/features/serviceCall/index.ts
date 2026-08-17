/**
 * L'appel de service, côté passager (E1).
 *
 * Un parcours distinct de la réservation : pas de stock, pas d'horaire, des
 * offres à comparer. Il partage le sélecteur de ville avec la recherche, parce
 * que c'est le même référentiel et le même geste.
 */
export { ServiceCallScreen } from './ui/ServiceCallScreen'
