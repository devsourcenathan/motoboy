import { isPersistedKey, queryKeys, QUERY_ROOT } from './queryKeys'

describe('isPersistedKey', () => {
  /**
   * Ce qui doit survivre à la fermeture : ce sans quoi la gare est perdue.
   * Le billet d'abord — c'est lui qu'on présente à l'embarquement, là où il n'y
   * a pas de réseau (I5).
   */
  it('garde les billets, les réservations et les départs', () => {
    expect(isPersistedKey(queryKeys.tickets())).toBe(true)
    expect(isPersistedKey(queryKeys.ticket('TKT-1'))).toBe(true)
    expect(isPersistedKey(queryKeys.booking('MTB-1'))).toBe(true)
    expect(isPersistedKey(queryKeys.trip('TR-1'))).toBe(true)
  })

  /**
   * Le cache est écrit **en clair**. Le profil ne doit pas y rester : il
   * serait lisible après une déconnexion, sur un téléphone qui change de
   * mains.
   */
  it('ne garde ni le profil ni les recherches', () => {
    expect(isPersistedKey(queryKeys.me())).toBe(false)
    expect(isPersistedKey(queryKeys.places('dou'))).toBe(false)
    expect(isPersistedKey(queryKeys.search({ from: 1, to: 2, date: '2026-08-15' }))).toBe(
      false,
    )
  })

  /**
   * Un paiement en cours n'a rien à faire sur le disque : son état change, et
   * un état figé ferait croire à un encaissement qui n'a pas eu lieu.
   */
  it('ne garde pas les paiements', () => {
    expect(isPersistedKey(queryKeys.payment('PAY-1'))).toBe(false)
  })

  it('ignore une clé vide ou inconnue', () => {
    expect(isPersistedKey([])).toBe(false)
    expect(isPersistedKey(['inconnu'])).toBe(false)
  })
})

describe('queryKeys', () => {
  /**
   * Le plan de sièges se rafraîchit **sans** invalider le départ entier : ils
   * partagent la racine mais pas la clé.
   */
  it('distingue le départ de son plan de sièges', () => {
    expect(queryKeys.trip('TR-1')).not.toEqual(queryKeys.tripSeats('TR-1'))
    expect(queryKeys.tripSeats('TR-1')[0]).toBe(QUERY_ROOT.trip)
  })

  /**
   * Le devis dépend de la sélection : « une place » et « tout le monde » ne
   * doivent pas partager un cache, sinon le montant annoncé est celui de
   * l'autre.
   */
  it('sépare les devis par sélection', () => {
    expect(queryKeys.cancellationQuote('MTB-1', [])).not.toEqual(
      queryKeys.cancellationQuote('MTB-1', [7]),
    )
  })

  /** L'ordre de sélection ne change pas le devis : la clé non plus. */
  it('ignore l’ordre des passagers', () => {
    expect(queryKeys.cancellationQuote('MTB-1', [7, 3])).toEqual(
      queryKeys.cancellationQuote('MTB-1', [3, 7]),
    )
  })
})
