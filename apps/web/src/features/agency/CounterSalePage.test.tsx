import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { CounterSalePage } from './CounterSalePage'

/**
 * La vente au guichet.
 *
 * **Le seul écran dont la vitesse est une exigence fonctionnelle** (I2). Ce que
 * les tests protègent ici, c'est ce qui la rendrait lente ou fausse : une place
 * tenue vendue quand même, une clé d'idempotence absente, un formulaire qui ne
 * se vide pas entre deux clients.
 */
const trip = {
  reference: 'TR-001',
  agency: { id: 1, name: 'Général Express' },
  departure_at: '2026-08-18T07:00:00Z',
  origin_station: { id: 1, name: 'Bonabéri', city: 'Douala' },
  destination_station: { id: 2, name: 'Gare', city: 'Bafoussam' },
  price: { amount: 6500, currency: 'XAF' },
  seats_available: 12,
  seating_mode: 'SEATED',
  vehicle_type: 'BUS',
}

const seats = () =>
  jsonResponse({
    seating_mode: 'SEATED',
    capacity: 3,
    seats_available: 1,
    seats: [
      { id: 1, label: 'A1', status: 'AVAILABLE' },
      { id: 2, label: 'A2', status: 'HELD' },
      { id: 3, label: 'A3', status: 'TAKEN' },
    ],
  })

const routes = {
  '/agency/trips/TR-001/seats': seats,
  '/agency/trips': () => jsonResponse({ data: [trip], meta: { page: 1, per_page: 20, total: 1, last_page: 1 } }),
  '/agency/counter-sales': () =>
    jsonResponse({ booking: { reference: 'BKG-1', total: { amount: 6500, currency: 'XAF' } } }, 201),
}

async function pickTrip() {
  await userEvent.click(await screen.findByRole('button', { name: /Douala → Bafoussam/ }))
}

describe('CounterSalePage', () => {
  /**
   * **Une place tenue n'est pas une place vendue.** Elle peut se libérer dans
   * quelques minutes, et la confondre avec « prise » ferait dire « complet » à un
   * agent devant un client qui n'aurait qu'à patienter. Aucune des deux ne se
   * vend, mais elles ne se disent pas pareil.
   */
  it('ne laisse vendre que les sièges libres', async () => {
    mockRoutes(routes)

    render(<CounterSalePage />)
    await pickTrip()

    expect(await screen.findByRole('button', { name: 'A1' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'A2' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'A3' })).toBeDisabled()
  })

  it('exige un siège avant de vendre en mode place attribuée', async () => {
    mockRoutes(routes)

    render(<CounterSalePage />)
    await pickTrip()

    await userEvent.type(await screen.findByLabelText('Prénom'), 'Awa')
    await userEvent.type(screen.getByLabelText('Nom'), 'Nkeng')
    await userEvent.type(screen.getByLabelText(/Téléphone/), '+237690000001')

    expect(screen.getByRole('button', { name: 'Vendre' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'A1' }))

    expect(screen.getByRole('button', { name: 'Vendre' })).toBeEnabled()
  })

  /**
   * Sans clé, une requête qui expire côté client mais aboutit côté serveur — banal
   * sur une connexion de gare — ferait vendre deux fois la même place.
   */
  it('vend avec une clé d’idempotence', async () => {
    mockRoutes(routes)

    render(<CounterSalePage />)
    await pickTrip()

    await userEvent.type(await screen.findByLabelText('Prénom'), 'Awa')
    await userEvent.type(screen.getByLabelText('Nom'), 'Nkeng')
    await userEvent.type(screen.getByLabelText(/Téléphone/), '+237690000001')
    await userEvent.click(screen.getByRole('button', { name: 'A1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Vendre' }))

    const mock = fetch as unknown as { mock: { calls: [Request | string][] } }

    await waitFor(() => {
      const sale = mock.mock.calls
        .map(([input]) => input)
        .find((input) => typeof input !== 'string' && input.url.includes('/counter-sales'))

      expect(sale).toBeDefined()
      expect((sale as Request).headers.get('Idempotency-Key')).toBeTruthy()
    })
  })

  /**
   * Au guichet il y a quelqu'un derrière : un formulaire qui garde le nom du
   * client précédent coûte le geste de trop qui fait revenir au cahier.
   */
  it('vide le formulaire après une vente', async () => {
    mockRoutes(routes)

    render(<CounterSalePage />)
    await pickTrip()

    const firstName = await screen.findByLabelText('Prénom')

    await userEvent.type(firstName, 'Awa')
    await userEvent.type(screen.getByLabelText('Nom'), 'Nkeng')
    await userEvent.type(screen.getByLabelText(/Téléphone/), '+237690000001')
    await userEvent.click(screen.getByRole('button', { name: 'A1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Vendre' }))

    await waitFor(() => expect(firstName).toHaveValue(''))
  })
})
