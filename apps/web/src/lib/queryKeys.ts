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

  /*
   * Administration. Même raison que pour les chauffeurs : le statut appartient à
   * la clé, sinon une décision laisse la file d'arrivée périmée.
   */
  agencies: (status: string) => ['agencies', status] as const,
  agency: (reference: string) => ['agency', reference] as const,
  settings: () => ['settings'] as const,
  stations: () => ['stations'] as const,
  cityRequests: () => ['city-requests'] as const,
  dashboard: () => ['dashboard'] as const,
  /*
   * La page fait partie de la clé, et c'est ce qui rend la pagination
   * utilisable : sans elle, revenir à la page précédente refait un aller-retour
   * réseau pour des données déjà chargées.
   */
  auditLogs: (action: string, page: number) => ['audit-logs', action, page] as const,
} as const
