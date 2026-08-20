import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { CounterSalePage } from './CounterSalePage'

/**
 * L'annulation d'une réservation au guichet.
 *
 * Elle libère des places et déclenche un remboursement : deux effets qu'on ne
 * reprend pas. Les tests portent sur ce qui les rend sûrs.
 */
const routes = (extra: Record<string, () => Response> = {}) => ({
  ...extra,
  '/agency/trips': () => jsonResponse({ data: [] }),
})

describe('Annulation au guichet', () => {
  /**
   * **Deux étapes, et c'est le sujet.** Le premier appui n'annule rien : il
   * demande confirmation en nommant la référence et en rappelant qu'un
   * remboursement suit.
   */
  it('demande confirmation avant d’annuler', async () => {
    mockRoutes(routes())

    render(<CounterSalePage />)

    await userEvent.type(
      await screen.findByLabelText(/Référence de la réservation/),
      'MTB-ABC123',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Annuler cette réservation' }),
    )

    expect(screen.getByText(/rembourser le passager/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeInTheDocument()
  })

  /**
   * **Le test qui compte.** Deux annulations successives doivent porter deux clés
   * d'idempotence distinctes. Une clé réutilisée ferait traiter la seconde comme
   * un rejeu de la première : le serveur rendrait le résultat de l'autre
   * réservation, et celle qu'on visait resterait intacte en ayant l'air annulée.
   */
  it('donne une clé d’idempotence différente à chaque annulation', async () => {
    mockRoutes(
      routes({
        '/cancel': () => jsonResponse({ refund: { amount: 5000, currency: 'XAF' } }),
      }),
    )

    render(<CounterSalePage />)

    const field = await screen.findByLabelText(/Référence de la réservation/)

    const annuler = async (reference: string) => {
      await userEvent.clear(field)
      await userEvent.type(field, reference)
      await userEvent.click(
        screen.getByRole('button', { name: 'Annuler cette réservation' }),
      )
      await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
      await sentRequest((request) => request.url.includes(reference))
    }

    await annuler('MTB-AAA111')
    await annuler('MTB-BBB222')

    const calls = (
      fetch as unknown as { mock: { calls: [Request | string][] } }
    ).mock.calls
      .map(([input]) => input)
      .filter((input): input is Request => typeof input !== 'string')
      .filter((request) => request.url.includes('/cancel'))
      .map((request) => request.headers.get('Idempotency-Key'))

    expect(calls).toHaveLength(2)
    expect(calls[0]).not.toBeNull()
    expect(calls[0]).not.toBe(calls[1])
  })
})
