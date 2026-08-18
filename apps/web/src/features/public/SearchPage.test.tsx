import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { calledUrls, jsonResponse, mockRoutes, render } from '../../test/render'
import { SearchPage } from './SearchPage'

/**
 * La recherche publique.
 *
 * **Sans compte** (§35). Ce que les tests protègent : qu'aucune session ne soit
 * requise, que la recherche vive dans l'URL — donc qu'un lien se partage — et
 * qu'un jour sans départ ne se lise pas comme une panne.
 */
const trip = {
  reference: 'TR-001',
  agency: { id: 1, name: 'Général Express' },
  departure_at: '2026-08-20T07:00:00Z',
  origin_station: { id: 1, name: 'Bonabéri', city: 'Douala' },
  destination_station: { id: 2, name: 'Gare', city: 'Bafoussam' },
  price: { amount: 6500, currency: 'XAF' },
  seats_available: 12,
  seating_mode: 'SEATED',
  vehicle_type: 'BUS',
}

const routes = {
  '/v1/search': () => jsonResponse({ data: [trip], suggestions: null }),
  '/places/autocomplete': () =>
    jsonResponse({
      data: [
        { type: 'CITY', city_id: 5, station_id: null, label: 'Douala', secondary_label: null },
      ],
    }),
}

describe('SearchPage', () => {
  /**
   * Aucune session : la page doit s'afficher entière sans jeton. C'est le premier
   * écran du produit, et le mettre derrière une connexion perdrait les gens sur
   * une question qu'ils ne se posaient pas.
   */
  it('s’affiche sans session', async () => {
    mockRoutes(routes)

    render(<SearchPage />)

    expect(screen.getByRole('heading', { name: /Comparez les départs/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chercher' })).toBeInTheDocument()
  })

  it('n’interroge rien tant que la recherche n’est pas lancée', () => {
    mockRoutes(routes)

    render(<SearchPage />)

    expect(calledUrls().some((url) => url.includes('/v1/search'))).toBe(false)
  })

  /**
   * **L'état vit dans l'URL** : une recherche se partage par lien, se recharge
   * sans se perdre, et le bouton retour fait ce qu'on attend.
   */
  it('lit la recherche depuis l’URL et affiche les départs', async () => {
    mockRoutes(routes)

    render(<SearchPage />, {
      route: '/?origin=5&destination=7&date=2026-08-20&passengers=1',
    })

    expect(await screen.findByText(/Général Express/)).toBeInTheDocument()

    await waitFor(() =>
      expect(calledUrls().some((url) => url.includes('origin_city_id=5'))).toBe(true),
    )
  })

  it('dit qu’il n’y a pas de départ plutôt que de rester vide', async () => {
    mockRoutes({
      ...routes,
      '/v1/search': () => jsonResponse({ data: [], suggestions: null }),
    })

    render(<SearchPage />, {
      route: '/?origin=5&destination=7&date=2026-08-20&passengers=1',
    })

    expect(await screen.findByText('Aucun départ ce jour-là')).toBeInTheDocument()
  })

  /**
   * La réservation vit dans l'application. Le dire ici évite qu'on cherche un
   * bouton qui n'existe pas — le web public informe, l'application vend.
   */
  it('renvoie vers l’application pour réserver', async () => {
    mockRoutes(routes)

    render(<SearchPage />)

    expect(
      screen.getByText(/La réservation et le paiement se font depuis l’application/),
    ).toBeInTheDocument()
  })
})
