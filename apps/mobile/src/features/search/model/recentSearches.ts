import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CityChoice } from './searchForm'

const KEY = 'motoboy.search.recent'

/** Au-delà, la liste cesse d'être un raccourci et devient un historique. */
const KEEP = 4

export interface RecentSearch {
  readonly from: CityChoice
  readonly to: CityChoice
  readonly date: string
  readonly passengers: number
}

/**
 * Les dernières recherches, sur l'appareil.
 *
 * **Sur l'appareil et non dans le compte** : la recherche fonctionne sans
 * session — c'est même un choix du brief (§35) — et l'attacher au compte
 * priverait du raccourci exactement les gens qui n'en ont pas encore.
 *
 * Aucune donnée sensible : deux villes et une date. Le cache est écrit en clair,
 * ce qui exclut le profil mais pas un trajet que le passager vient de composer
 * lui-même à l'écran.
 */
export async function readRecentSearches(): Promise<readonly RecentSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)

    if (raw === null) return []

    const parsed: unknown = JSON.parse(raw)

    // Le stockage survit aux mises à jour : une forme ancienne ou corrompue est
    // ignorée plutôt que de faire planter l'écran d'accueil.
    return Array.isArray(parsed) ? parsed.filter(isRecentSearch) : []
  } catch {
    return []
  }
}

/**
 * Ajoute une recherche en tête.
 *
 * Le même trajet ne s'empile pas : refaire Douala → Yaoundé trois fois de suite
 * remplirait la liste d'une seule ligne répétée. La date, elle, ne compte pas
 * dans l'identité — c'est le couple de villes qu'on veut retrouver.
 */
export async function rememberSearch(search: RecentSearch): Promise<void> {
  try {
    const previous = await readRecentSearches()
    const deduped = previous.filter(
      (entry) =>
        !(
          entry.from.cityId === search.from.cityId && entry.to.cityId === search.to.cityId
        ),
    )

    await AsyncStorage.setItem(KEY, JSON.stringify([search, ...deduped].slice(0, KEEP)))
  } catch {
    // Sans conséquence : le raccourci manquera, la recherche fonctionne.
  }
}

function isRecentSearch(value: unknown): value is RecentSearch {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Partial<RecentSearch>

  return (
    isCity(candidate.from) &&
    isCity(candidate.to) &&
    typeof candidate.date === 'string' &&
    typeof candidate.passengers === 'number'
  )
}

function isCity(value: unknown): value is CityChoice {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Partial<CityChoice>

  return typeof candidate.cityId === 'number' && typeof candidate.label === 'string'
}
