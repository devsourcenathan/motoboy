import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { DeparturesPage } from './DeparturesPage'

/**
 * Les départs.
 *
 * **Annuler rembourse tout le monde, et ne se reprend pas.** Ce que les tests
 * protègent, c'est que l'agence le sache avant d'agir, et que le motif parte sous
 * une forme que l'administration peut compter.
 */
const trip = {
  reference: 'TR-001',
  agency: { id: 1, name: 'Général Express' },
  departure_at: '2026-08-20T07:00:00Z',
  origin_station: { id: 1, name: 'Bonabéri', city: 'Douala' },
  destination_station: { id: 2, name: 'Gare', city: 'Bafoussam' },
  price: { amount: 6500, currency: 'XAF' },
  seats_available: 3,
  seating_mode: 'SEATED',
  vehicle_type: 'BUS',
}

const routes = {
  '/cancel': () => jsonResponse({ reference: 'TR-001', status: 'CANCELLED' }),
  '/agency/trips': () =>
    jsonResponse({
      data: [trip],
      meta: { page: 1, per_page: 20, total: 1, last_page: 1 },
    }),
}

describe('DeparturesPage', () => {
  it('renvoie vers la génération quand aucun départ n’existe', async () => {
    mockRoutes({
      '/agency/trips': () =>
        jsonResponse({
          data: [],
          meta: { page: 1, per_page: 20, total: 0, last_page: 1 },
        }),
    })

    render(<DeparturesPage />)

    expect(await screen.findByText('Aucun départ sur cette période')).toBeInTheDocument()
  })

  /**
   * **La conséquence est dite avant qu'on demande le motif.** La découvrir une
   * fois le geste fait serait trop tard : l'annulation ne se reprend pas.
   */
  it('prévient du remboursement avant de demander le motif', async () => {
    mockRoutes(routes)

    render(<DeparturesPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }))

    expect(screen.getByText(/remboursés intégralement/)).toBeInTheDocument()
  })

  /**
   * Un motif **choisi**, jamais saisi : le taux d'annulation est suivi par cause,
   * et du texte libre ne se compte pas.
   */
  it('envoie un motif de la liste, et la précision à part', async () => {
    mockRoutes(routes)

    render(<DeparturesPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }))
    await userEvent.selectOptions(screen.getByLabelText(/Motif/), 'ROAD_CLOSED')
    await userEvent.type(screen.getByLabelText(/Précision/), 'Pont coupé')
    await userEvent.click(screen.getByRole('button', { name: /Annuler ce départ/ }))

    const mock = fetch as unknown as { mock: { calls: [Request | string][] } }

    await waitFor(async () => {
      const call = mock.mock.calls
        .map(([input]) => input)
        .find((input) => typeof input !== 'string' && input.url.endsWith('/cancel'))

      expect(call).toBeDefined()

      const body = await (call as Request).clone().text()

      expect(JSON.parse(body)).toEqual({ reason: 'ROAD_CLOSED', note: 'Pont coupé' })
    })
  })
})
