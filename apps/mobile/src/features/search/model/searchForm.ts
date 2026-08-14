import type { PlaceSuggestion } from '@motoboy/api-client/types'

/**
 * Une ville retenue pour la recherche.
 *
 * **Toujours une ville, jamais une gare.** L'autocomplétion propose les deux,
 * mais une gare résout vers sa ville : la recherche s'exécute au niveau ville,
 * sans quoi deux agences desservant Douala depuis deux gares différentes ne
 * seraient jamais comparées — ce qui est précisément l'objet du produit.
 */
export interface CityChoice {
  readonly cityId: number
  readonly label: string
}

export function toCityChoice(suggestion: PlaceSuggestion): CityChoice {
  return {
    cityId: suggestion.city_id,
    // Pour une gare, l'étiquette utile est sa ville de rattachement : c'est
    // elle qui sera cherchée, et afficher le nom de la gare laisserait croire
    // que la recherche s'y limite.
    label: suggestion.secondary_label ?? suggestion.label,
  }
}

/**
 * Plafond du nombre de voyageurs d'une même recherche.
 *
 * Au-delà, c'est un groupe : le plan de sièges ne permet plus de placer tout le
 * monde ensemble sur un car de dix-huit places, et la conversation se fait avec
 * l'agence. Le plafond est ici pour borner le pas-à-pas, pas pour décider — le
 * serveur reste seul juge de ce qui est réservable.
 */
export const MAX_PASSENGERS = 6

export interface SearchForm {
  readonly from: CityChoice | null
  readonly to: CityChoice | null
  /** `YYYY-MM-DD`, dans le fuseau d'affichage. */
  readonly date: string
  /**
   * Nombre de voyageurs.
   *
   * Il ne filtre pas la recherche — l'API compare des départs, pas des
   * disponibilités par groupe — mais il **traverse le parcours** jusqu'au plan
   * de sièges, où il dit combien de places choisir. Le saisir ici évite de le
   * redemander trois écrans plus loin.
   */
  readonly passengers: number
}

export type SearchFormError = 'INCOMPLETE' | 'SAME_CITY' | null

/**
 * Ce qui empêche de lancer la recherche.
 *
 * Vérifié côté client **pour éviter un aller-retour inutile**, jamais pour
 * décider : le backend reste la seule autorité sur ce qui est cherchable
 * (§29 du brief).
 */
export function validate(form: SearchForm): SearchFormError {
  if (form.from === null || form.to === null) return 'INCOMPLETE'
  if (form.from.cityId === form.to.cityId) return 'SAME_CITY'

  return null
}

export function swap(form: SearchForm): SearchForm {
  return { ...form, from: form.to, to: form.from }
}

/**
 * Date du jour dans le fuseau d'affichage.
 *
 * Le serveur raisonne en UTC, l'utilisateur en heure locale : construire la
 * date depuis l'horloge du téléphone ferait chercher la veille pour quelqu'un
 * qui ouvre l'application à une heure du matin.
 */
export function todayInDisplayTimezone(timeZone: string, now: Date = new Date()): string {
  // `en-CA` produit `YYYY-MM-DD`, le format attendu par le contrat — obtenu
  // sans dépendance ni découpage de chaîne à la main.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)

  // `Date.UTC` évite qu'un décalage horaire fasse basculer d'un jour lors de
  // l'addition — l'heure locale du téléphone n'entre pas dans le calcul.
  const shifted = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days))

  return shifted.toISOString().slice(0, 10)
}
