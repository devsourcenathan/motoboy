import type { CityChoice } from '../../search/model/searchForm'

/** Au-delà, ce n'est plus une voiture qu'on appelle mais un car. */
export const MAX_TRAVELLERS = 6

export interface ServiceCallForm {
  readonly from: CityChoice | null
  /**
   * Où attendre, en texte libre.
   *
   * **Obligatoire.** La ville ne suffit pas à se retrouver : un chauffeur qui
   * accepte sans savoir où se rendre appellera, et c'est précisément l'échange
   * que la demande existe pour éviter.
   */
  readonly fromLandmark: string
  readonly to: CityChoice | null
  /** Facultatif : à l'arrivée, on se laisse déposer où l'on s'entend. */
  readonly toLandmark: string
  readonly travellers: number
  readonly note: string
}

export type ServiceCallError = 'INCOMPLETE' | 'SAME_CITY' | 'MISSING_LANDMARK' | null

export function emptyServiceCall(): ServiceCallForm {
  return {
    from: null,
    fromLandmark: '',
    to: null,
    toLandmark: '',
    travellers: 1,
    note: '',
  }
}

/**
 * Ce qui empêche d'envoyer la demande.
 *
 * Vérifié côté client **pour éviter un aller-retour**, jamais pour décider : le
 * serveur reste seul juge (§29 du brief).
 */
export function validate(form: ServiceCallForm): ServiceCallError {
  if (form.from === null || form.to === null) return 'INCOMPLETE'
  if (form.from.cityId === form.to.cityId) return 'SAME_CITY'
  if (form.fromLandmark.trim() === '') return 'MISSING_LANDMARK'

  return null
}
