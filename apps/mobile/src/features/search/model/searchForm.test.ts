import {
  addDays,
  swap,
  toCityChoice,
  todayInDisplayTimezone,
  validate,
  type SearchForm,
} from './searchForm'
import type { PlaceSuggestion } from '@motoboy/api-client/types'

const DOUALA = 'Africa/Douala'

describe('todayInDisplayTimezone', () => {
  /**
   * Le cas qui motive cette fonction.
   *
   * À 00 h 30 UTC, il est déjà 01 h 30 à Douala : le passager est au lendemain,
   * et une date construite sur l'horloge UTC le ferait chercher la veille.
   */
  it('suit le fuseau du produit, pas celui du serveur', () => {
    expect(todayInDisplayTimezone(DOUALA, new Date('2026-08-15T00:30:00Z'))).toBe(
      '2026-08-15',
    )
  })

  it('bascule au bon moment en fin de journée', () => {
    // 23 h 30 à Douala le 14, soit 22 h 30 UTC : encore le 14.
    expect(todayInDisplayTimezone(DOUALA, new Date('2026-08-14T22:30:00Z'))).toBe(
      '2026-08-14',
    )
    // Une heure plus tard, minuit passé à Douala.
    expect(todayInDisplayTimezone(DOUALA, new Date('2026-08-14T23:30:00Z'))).toBe(
      '2026-08-15',
    )
  })

  it('rend toujours le format attendu par le contrat', () => {
    expect(todayInDisplayTimezone(DOUALA, new Date('2026-03-05T10:00:00Z'))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    )
  })
})

describe('addDays', () => {
  it('franchit les fins de mois', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-04-30', 1)).toBe('2026-05-01')
  })

  it('franchit les fins d’année', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('connaît les années bissextiles', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('recule aussi', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('validate', () => {
  const douala = { cityId: 1, label: 'Douala' }
  const bafoussam = { cityId: 2, label: 'Bafoussam' }

  /** Le nombre de voyageurs n'entre pas dans la validation : il ne filtre rien. */
  const form = (over: Partial<SearchForm>): SearchForm => ({
    from: null,
    to: null,
    date: '2026-08-15',
    passengers: 1,
    ...over,
  })

  it('refuse tant qu’une ville manque', () => {
    expect(validate(form({ to: bafoussam }))).toBe('INCOMPLETE')
    expect(validate(form({ from: douala }))).toBe('INCOMPLETE')
  })

  /** Le serveur refuserait de toute façon : autant l'éviter d'un aller-retour. */
  it('refuse deux fois la même ville', () => {
    expect(validate(form({ from: douala, to: { ...douala } }))).toBe('SAME_CITY')
  })

  it('accepte deux villes distinctes', () => {
    expect(validate(form({ from: douala, to: bafoussam }))).toBeNull()
  })
})

describe('swap', () => {
  it('échange les deux villes sans toucher à la date', () => {
    const form: SearchForm = {
      from: { cityId: 1, label: 'Douala' },
      to: { cityId: 2, label: 'Bafoussam' },
      date: '2026-08-15',
      passengers: 2,
    }

    // Ni la date ni le nombre de voyageurs ne bougent : seules les villes
    // s'échangent.
    expect(swap(form)).toEqual({
      from: form.to,
      to: form.from,
      date: '2026-08-15',
      passengers: 2,
    })
  })

  it('reste utilisable quand une seule ville est choisie', () => {
    const form: SearchForm = {
      from: { cityId: 1, label: 'Douala' },
      to: null,
      date: '2026-08-15',
      passengers: 1,
    }

    expect(swap(form).to).toEqual(form.from)
    expect(swap(form).from).toBeNull()
  })
})

describe('toCityChoice', () => {
  it('garde la ville telle quelle', () => {
    const city: PlaceSuggestion = { type: 'CITY', city_id: 7, label: 'Douala' }

    expect(toCityChoice(city)).toEqual({ cityId: 7, label: 'Douala' })
  })

  /**
   * Le point qui fait tout le produit : une gare cherche **sa ville**. Sans
   * cela, deux agences desservant Douala depuis deux gares différentes ne
   * seraient jamais comparées.
   */
  it('résout une gare vers sa ville de rattachement', () => {
    const station: PlaceSuggestion = {
      type: 'STATION',
      city_id: 7,
      station_id: 42,
      label: 'Gare de Bonabéri',
      secondary_label: 'Douala',
    }

    expect(toCityChoice(station)).toEqual({ cityId: 7, label: 'Douala' })
  })
})
