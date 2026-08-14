import type { Seat, SeatMap } from '@motoboy/api-client/types'
import { byRow, hasSeatMap, isComplete, isSelectable, toggleSeat } from './seatSelection'

function seat(id: number, status: Seat['status'], row = 1, column = 1): Seat {
  return {
    id,
    label: `${row}${String.fromCharCode(64 + column)}`,
    status,
    row_index: row,
    column_index: column,
  }
}

describe('isSelectable', () => {
  it('n’accepte que les places libres', () => {
    expect(isSelectable(seat(1, 'AVAILABLE'))).toBe(true)
  })

  /**
   * Le point qui compte : une place **tenue** par un paiement en cours peut se
   * libérer, mais rien ne le garantit. La proposer ferait échouer la
   * réservation au dernier écran, après la saisie des noms (B2).
   */
  it('refuse une place tenue, comme une place vendue', () => {
    expect(isSelectable(seat(1, 'HELD'))).toBe(false)
    expect(isSelectable(seat(2, 'TAKEN'))).toBe(false)
  })

  it('refuse une place non vendable', () => {
    expect(isSelectable(seat(1, 'UNAVAILABLE'))).toBe(false)
  })
})

describe('toggleSeat', () => {
  it('ajoute puis retire', () => {
    const free = seat(7, 'AVAILABLE')

    expect(toggleSeat([], free, 2)).toEqual([7])
    expect(toggleSeat([7], free, 2)).toEqual([])
  })

  it('ignore une place indisponible', () => {
    expect(toggleSeat([], seat(7, 'HELD'), 2)).toEqual([])
  })

  /** Deux passagers, deux places : la troisième ne s'ajoute pas. */
  it('ne dépasse jamais le nombre de passagers', () => {
    expect(toggleSeat([1, 2], seat(3, 'AVAILABLE'), 2)).toEqual([1, 2])
  })

  it('laisse désélectionner même une fois le quota atteint', () => {
    expect(toggleSeat([1, 2], seat(2, 'AVAILABLE'), 2)).toEqual([1])
  })
})

describe('byRow', () => {
  it('groupe par rangée et ordonne les colonnes', () => {
    const rows = byRow([
      seat(3, 'AVAILABLE', 2, 1),
      seat(2, 'AVAILABLE', 1, 2),
      seat(1, 'AVAILABLE', 1, 1),
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]?.map((s) => s.id)).toEqual([1, 2])
    expect(rows[1]?.map((s) => s.id)).toEqual([3])
  })
})

describe('mode capacité', () => {
  const capacity: SeatMap = {
    seating_mode: 'CAPACITY',
    capacity: 18,
    seats_available: 4,
    seats: [],
  }

  /**
   * En mode capacité il n'y a **pas de plan** : la protection repose sur un
   * compteur, et inventer des sièges reviendrait à en afficher qui n'existent
   * pas dans le car.
   */
  it('n’affiche aucun plan', () => {
    expect(hasSeatMap(capacity)).toBe(false)
  })

  it('est complet dès qu’il reste assez de places', () => {
    expect(isComplete([], 3, capacity)).toBe(true)
    expect(isComplete([], 5, capacity)).toBe(false)
  })
})

describe('mode sièges', () => {
  const seated: SeatMap = {
    seating_mode: 'SEATED',
    capacity: 30,
    seats_available: 2,
    seats: [seat(1, 'AVAILABLE'), seat(2, 'HELD', 1, 2)],
  }

  it('affiche un plan', () => {
    expect(hasSeatMap(seated)).toBe(true)
  })

  it('exige une place par passager', () => {
    expect(isComplete([1], 2, seated)).toBe(false)
    expect(isComplete([1, 3], 2, seated)).toBe(true)
  })
})
