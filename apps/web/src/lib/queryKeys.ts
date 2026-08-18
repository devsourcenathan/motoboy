import type { DriverStatus } from '@motoboy/api-client/types'

/**
 * Les clés de cache, en un seul endroit.
 *
 * Écrites à la main dans chaque écran, elles divergent : une invalidation vise
 * `['drivers']` quand la requête s'est enregistrée sous `['drivers', 'PENDING']`,
 * et l'écran garde une file périmée après une décision. C'est précisément le
 * genre de bogue qu'on ne voit qu'en production, parce qu'en développement on
 * recharge la page.
 */
export const queryKeys = {
  me: () => ['me'] as const,
  /**
   * Le statut fait partie de la clé : la file « en attente » et la file
   * « refusés » sont deux listes, pas deux vues d'une même liste.
   */
  drivers: (status: DriverStatus) => ['drivers', status] as const,
} as const
