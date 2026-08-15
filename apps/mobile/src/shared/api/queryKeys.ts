/**
 * Clés de cache, en un seul endroit.
 *
 * **Une clé écrite à la main est une clé qu'on invalide mal.** Éparpiller
 * `['tickets']` dans les écrans laisse chacun inventer sa variante — `'ticket'`
 * au singulier ici, un identifiant oublié là — et l'invalidation après une
 * réservation cesse silencieusement de rafraîchir la liste. Le bogue n'apparaît
 * pas à la compilation : il apparaît quand un passager ne voit pas son billet.
 *
 * D'où une fabrique typée, et des racines déclarées comme constantes plutôt
 * qu'en chaînes libres.
 */
export const QUERY_ROOT = {
  places: 'places',
  search: 'search',
  trip: 'trip',
  bookings: 'bookings',
  tickets: 'tickets',
  payments: 'payments',
  me: 'me',
} as const

export type QueryRoot = (typeof QUERY_ROOT)[keyof typeof QUERY_ROOT]

export const queryKeys = {
  places: (query: string) => [QUERY_ROOT.places, query] as const,

  // Le tri fait partie de la clé : deux ordres différents sont deux réponses
  // différentes, et les confondre afficherait le classement précédent.
  search: (params: { from: number; to: number; date: string; sort?: string }) =>
    [QUERY_ROOT.search, params.from, params.to, params.date, params.sort ?? 'best'] as const,

  trip: (reference: string) => [QUERY_ROOT.trip, reference] as const,
  tripSeats: (reference: string) => [QUERY_ROOT.trip, reference, 'seats'] as const,

  bookings: () => [QUERY_ROOT.bookings] as const,
  booking: (reference: string) => [QUERY_ROOT.bookings, reference] as const,

  /*
   * Le devis dépend de la sélection **et** du temps restant. Les identifiants
   * entrent donc dans la clé : partager un cache entre « une place » et « tout
   * le monde » annoncerait le mauvais montant.
   */
  cancellationQuote: (reference: string, passengerIds: readonly number[]) =>
    [
      QUERY_ROOT.bookings,
      reference,
      'cancellation-quote',
      [...passengerIds].sort(),
    ] as const,

  payment: (reference: string) => [QUERY_ROOT.payments, reference] as const,

  tickets: () => [QUERY_ROOT.tickets] as const,
  ticket: (reference: string) => [QUERY_ROOT.tickets, reference] as const,

  me: () => [QUERY_ROOT.me] as const,
} as const

/**
 * Ce qui survit à la fermeture de l'application.
 *
 * Le cache est écrit **en clair** sur le disque. N'y entre donc que ce qui n'a
 * rien de secret et qui doit rester lisible sans réseau — un billet, un départ.
 * Le profil de l'utilisateur n'y est pas : il resterait lisible après une
 * déconnexion, sur un téléphone qui change de mains.
 *
 * Déclaré ici plutôt qu'à côté du cache : c'est une propriété de la clé, et la
 * placer ailleurs ferait oublier de l'y ajouter en même temps que la clé.
 */
const PERSISTED_ROOTS: ReadonlySet<QueryRoot> = new Set([
  QUERY_ROOT.tickets,
  QUERY_ROOT.bookings,
  QUERY_ROOT.trip,
])

export function isPersistedKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0]

  return typeof root === 'string' && PERSISTED_ROOTS.has(root as QueryRoot)
}
