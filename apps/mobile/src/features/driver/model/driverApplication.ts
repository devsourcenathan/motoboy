import type { CityChoice } from '../../search/model/searchForm'

/** Les deux types que le référentiel connaît. */
export const VEHICLE_TYPES = ['CAR', 'BUS'] as const

export type VehicleType = (typeof VEHICLE_TYPES)[number]

/** Les quatre pièces exigées par le dossier (C2). */
export const REQUIRED_DOCUMENTS = [
  'LICENSE',
  'REGISTRATION',
  'IDENTITY',
  'INSURANCE',
] as const

export type DocumentType = (typeof REQUIRED_DOCUMENTS)[number]

export const MAX_SEATS = 20

export interface DriverApplication {
  readonly licenceNumber: string
  /** Au format ISO `YYYY-MM-DD`, comme le contrat l'attend. */
  readonly licenceExpiresAt: string
  readonly plate: string
  readonly vehicleType: VehicleType
  readonly model: string
  readonly seats: number
  readonly city: CityChoice | null
}

export const emptyApplication: DriverApplication = {
  licenceNumber: '',
  licenceExpiresAt: '',
  plate: '',
  vehicleType: 'CAR',
  model: '',
  seats: 4,
  city: null,
}

export type ApplicationError = 'INCOMPLETE' | 'EXPIRED_LICENCE' | null

/**
 * Ce qui empêche d'envoyer le dossier.
 *
 * **Le permis périmé est refusé ici et pas seulement au serveur** : c'est la
 * seule règle du formulaire qu'un chauffeur peut violer de bonne foi, en
 * recopiant une date passée. La lui renvoyer après un aller-retour réseau
 * laisserait croire à un refus d'instruction plutôt qu'à une faute de saisie.
 *
 * Le reste — plaque déjà prise, ville inconnue — se juge sur des données que le
 * téléphone n'a pas, et rester silencieux dessus est correct.
 */
export function validate(form: DriverApplication, today: string): ApplicationError {
  const complete =
    form.licenceNumber.trim() !== '' &&
    form.licenceExpiresAt !== '' &&
    form.plate.trim() !== '' &&
    form.seats >= 1 &&
    form.seats <= MAX_SEATS &&
    form.city !== null

  if (!complete) return 'INCOMPLETE'

  // Comparaison de chaînes ISO : à format égal, l'ordre lexicographique est
  // l'ordre chronologique, et aucun fuseau ne s'invite dans la décision.
  if (form.licenceExpiresAt <= today) return 'EXPIRED_LICENCE'

  return null
}

/** Les pièces qui manquent encore, dans l'ordre où elles sont demandées. */
export function missingDocuments(provided: readonly string[]): readonly DocumentType[] {
  return REQUIRED_DOCUMENTS.filter((type) => !provided.includes(type))
}
