import { fireEvent, render, screen } from '@testing-library/react-native'
import type { Seat } from '@motoboy/api-client/types'
import '../../../shared/i18n'
import { SeatGrid } from './SeatGrid'

function seat(id: number, status: Seat['status'], row = 1, column = 1): Seat {
  return {
    id,
    label: `${row}${String.fromCharCode(64 + column)}`,
    status,
    row_index: row,
    column_index: column,
  }
}

describe('SeatGrid', () => {
  it('rend chaque place avec son numéro', async () => {
    await render(
      <SeatGrid
        seats={[seat(1, 'AVAILABLE'), seat(2, 'AVAILABLE', 1, 2)]}
        selected={[]}
        onToggle={jest.fn()}
      />,
    )

    expect(screen.getByText('1A')).toBeTruthy()
    expect(screen.getByText('1B')).toBeTruthy()
  })

  it('remonte la place choisie', async () => {
    const onToggle = jest.fn()

    await render(
      <SeatGrid seats={[seat(5, 'AVAILABLE')]} selected={[]} onToggle={onToggle} />,
    )
    fireEvent.press(screen.getByText('1A'))

    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }))
  })

  /**
   * Une place tenue par un paiement en cours est indisponible **au même titre**
   * qu'une place vendue : la laisser cliquable ferait échouer la réservation au
   * dernier écran, après la saisie des noms (B2).
   */
  it('ne laisse choisir ni une place tenue ni une place vendue', async () => {
    const onToggle = jest.fn()

    await render(
      <SeatGrid
        seats={[seat(1, 'HELD'), seat(2, 'TAKEN', 1, 2)]}
        selected={[]}
        onToggle={onToggle}
      />,
    )

    fireEvent.press(screen.getByText('1A'))
    fireEvent.press(screen.getByText('1B'))

    expect(onToggle).not.toHaveBeenCalled()
  })

  /**
   * L'état est **dit**, pas seulement coloré : une place prise et une place
   * libre ne doivent pas se distinguer par la seule couleur.
   */
  it('annonce l’état de chaque place', async () => {
    await render(
      <SeatGrid
        seats={[seat(1, 'AVAILABLE'), seat(2, 'HELD', 1, 2), seat(3, 'TAKEN', 1, 3)]}
        selected={[]}
        onToggle={jest.fn()}
      />,
    )

    expect(screen.getByLabelText('1A, Libre')).toBeTruthy()
    expect(screen.getByLabelText('1B, Réservée')).toBeTruthy()
    expect(screen.getByLabelText('1C, Vendue')).toBeTruthy()
  })

  it('annonce une place choisie comme telle', async () => {
    await render(
      <SeatGrid seats={[seat(9, 'AVAILABLE')]} selected={[9]} onToggle={jest.fn()} />,
    )

    expect(screen.getByLabelText('1A, Choisie')).toBeTruthy()
  })
})
