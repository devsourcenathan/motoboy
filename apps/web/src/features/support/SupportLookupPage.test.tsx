import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { calledUrls, jsonResponse, mockFetch, render } from '../../test/render'
import { SupportLookupPage } from './SupportLookupPage'

/**
 * « Où en est ma course ? »
 *
 * L'écran du support. Il **constate**, il ne décide pas : annuler ou rembourser
 * d'ici contournerait les gardes des Actions.
 */
const REQUEST = {
  reference: 'SRV-XLXWP3',
  status: 'MATCHED',
  origin: { city_id: 23, city: 'Bafang', landmark: 'Carrefour Total' },
  destination: { city_id: 7, city: 'Douala', landmark: null },
  passengers: 2,
  note: null,
  expires_at: '2026-08-18T12:00:00Z',
  created_at: '2026-08-18T11:00:00Z',
  offers: [
    {
      id: 1,
      status: 'ACCEPTED',
      price: { amount: 8000, currency: 'XAF' },
      eta_minutes: 10,
      expires_at: '2026-08-18T11:30:00Z',
      driver: {
        first_name: 'Jean',
        vehicle_plate: 'LT-4412-AB',
        vehicle_model: 'Corolla',
        vehicle_seats: 4,
      },
    },
  ],
  ride: {
    reference: 'RID-WTG8CX',
    status: 'MATCHED',
    price: { amount: 8000, currency: 'XAF' },
    paid: true,
    driver: {
      first_name: 'Jean',
      last_name: 'Kamdem',
      phone: '+237690000101',
      vehicle_plate: 'LT-4412-AB',
      vehicle_model: 'Corolla',
    },
  },
}

describe('SupportLookupPage', () => {
  it('n’interroge rien avant qu’une référence soit validée', async () => {
    render(<SupportLookupPage />)

    await userEvent.type(screen.getByPlaceholderText('SRV-XXXXXX'), 'SRV-XL')

    /*
     * Une frappe ne déclenche pas de recherche : interroger l'API à chaque
     * caractère la questionnerait sur des références tronquées.
     */
    expect(calledUrls()).toHaveLength(0)
  })

  it('cherche la référence saisie, en majuscules', async () => {
    mockFetch(jsonResponse(REQUEST))

    render(<SupportLookupPage />)

    await userEvent.type(screen.getByPlaceholderText('SRV-XXXXXX'), 'srv-xlxwp3')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    await waitFor(() =>
      expect(calledUrls()[0]).toContain('/v1/admin/service-requests/SRV-XLXWP3'),
    )
  })

  it('montre le trajet, la course et son état de paiement', async () => {
    mockFetch(jsonResponse(REQUEST))

    render(<SupportLookupPage />)

    await userEvent.type(screen.getByPlaceholderText('SRV-XXXXXX'), 'SRV-XLXWP3')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    expect(await screen.findByText('RID-WTG8CX')).toBeInTheDocument()
    expect(screen.getByText(/Payée/)).toBeInTheDocument()
    expect(screen.getByText('+237690000101')).toBeInTheDocument()
  })

  /**
   * Les offres restent visibles **après** acceptation : le support doit pouvoir
   * répondre à « pourquoi ce prix ? », et la réponse est ce que les autres
   * chauffeurs proposaient au même moment.
   */
  it('garde les offres reçues sous les yeux', async () => {
    mockFetch(jsonResponse(REQUEST))

    render(<SupportLookupPage />)

    await userEvent.type(screen.getByPlaceholderText('SRV-XXXXXX'), 'SRV-XLXWP3')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    expect(await screen.findByText('Offres reçues')).toBeInTheDocument()
    expect(screen.getByText(/Jean · 10 min/)).toBeInTheDocument()
  })

  /**
   * **Lecture seule, par choix.** Le support constate ; agir d'ici contournerait
   * les gardes qui refusent de démarrer une course impayée ou de rembourser deux
   * fois. Ce test échouera le jour où quelqu'un ajoutera un bouton d'action —
   * ce qui est exactement le moment où il faut en reparler.
   */
  it('n’offre aucune action sur la course', async () => {
    mockFetch(jsonResponse(REQUEST))

    render(<SupportLookupPage />)

    await userEvent.type(screen.getByPlaceholderText('SRV-XXXXXX'), 'SRV-XLXWP3')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    await screen.findByText('RID-WTG8CX')

    const actions = screen
      .getAllByRole('button')
      .map((button) => button.textContent?.trim())
      .filter((label) => label !== 'Chercher')

    expect(actions).toEqual([])
  })

  it('dit qu’une référence est inconnue plutôt que de rester vide', async () => {
    mockFetch(jsonResponse({ code: 'NOT_FOUND', message: 'Aucune demande.' }, 404))

    render(<SupportLookupPage />)

    await userEvent.type(screen.getByPlaceholderText('SRV-XXXXXX'), 'SRV-INCONNU')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    expect(await screen.findByText(/introuvable|not found/i)).toBeInTheDocument()
  })
})
