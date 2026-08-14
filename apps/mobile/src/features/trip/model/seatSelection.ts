import type { Seat, SeatMap } from '@motoboy/api-client/types'

/**
 * Une place est-elle choisissable ?
 *
 * **`HELD` est indisponible au même titre que `TAKEN`.** Une place tenue par un
 * paiement en cours peut se libérer, mais rien ne le garantit : la proposer
 * ferait échouer la réservation au dernier écran, après que le passager a saisi
 * ses noms (B2). Les deux se distinguent à l'affichage — l'une peut revenir —
 * mais aucune des deux ne se sélectionne.
 */
export function isSelectable(seat: Seat): boolean {
  return seat.status === 'AVAILABLE'
}

/**
 * Bascule une place dans la sélection.
 *
 * Rien ne se passe si la place n'est pas choisissable, ou si le quota est
 * atteint et qu'on tente d'en ajouter une de plus : le nombre de places
 * sélectionnées ne peut jamais dépasser le nombre de passagers annoncé.
 */
export function toggleSeat(
  selected: readonly number[],
  seat: Seat,
  limit: number,
): readonly number[] {
  if (!isSelectable(seat)) return selected

  if (selected.includes(seat.id)) {
    return selected.filter((id) => id !== seat.id)
  }

  if (selected.length >= limit) return selected

  return [...selected, seat.id]
}

/**
 * Range les places par rangée, dans l'ordre du véhicule.
 *
 * L'API renvoie une liste plate. La reconstruire ici plutôt qu'à l'affichage
 * garde le composant sans logique, et rend le regroupement testable sans monter
 * de rendu.
 */
export function byRow(seats: readonly Seat[]): Seat[][] {
  const rows = new Map<number, Seat[]>()

  for (const seat of seats) {
    const index = seat.row_index ?? 0
    const row = rows.get(index) ?? []

    row.push(seat)
    rows.set(index, row)
  }

  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row.sort((a, b) => (a.column_index ?? 0) - (b.column_index ?? 0)))
}

/**
 * Le véhicule numérote-t-il ses places ?
 *
 * En mode `CAPACITY`, il n'y a **pas de plan à afficher** : la protection
 * repose sur un compteur, pas sur un index par siège. Prétendre le contraire
 * obligerait à inventer des sièges qui n'existent pas dans le car.
 */
export function hasSeatMap(map: SeatMap | undefined): boolean {
  return map?.seating_mode === 'SEATED' && (map.seats?.length ?? 0) > 0
}

/** La sélection est-elle complète ? */
export function isComplete(
  selected: readonly number[],
  passengers: number,
  map: SeatMap | undefined,
): boolean {
  // Sans plan de sièges, il n'y a rien à choisir : la réservation ne dépend que
  // du nombre de places restantes.
  if (!hasSeatMap(map)) return (map?.seats_available ?? 0) >= passengers

  return selected.length === passengers
}
