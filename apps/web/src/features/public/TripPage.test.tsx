import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { i18next } from '../../lib/i18n'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { TripPage } from './TripPage'

/**
 * La fiche d'un départ, côté public.
 *
 * **Le web informe, l'application vend.** C'est la seule chose que cette page
 * doit réussir à dire : sans elle, on y cherche un bouton « réserver » qui
 * n'existe pas.
 */
const trip = {
  reference: 'TR-ABC123',
  origin_station: { city: 'Douala', name: 'Bonabéri' },
  destination_station: { city: 'Bafoussam', name: 'Gare routière' },
  price: { amount: 5000, currency: 'XAF' },
  seats_available: 12,
  departure_at: '2026-08-20T08:00:00Z',
  agency: { name: 'Général Express' },
}

describe('TripPage', () => {
  it('renvoie vers l’application plutôt que d’offrir un bouton absent', async () => {
    mockRoutes({ '/trips/': () => jsonResponse(trip) })

    render(<TripPage />, { route: '/trips/TR-ABC123' })

    expect(await screen.findByText(/depuis l’application MOTOBOY/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Réserver/ })).not.toBeInTheDocument()
  })

  /**
   * Une référence inconnue doit se dire, pas laisser une page à moitié rendue :
   * un lien partagé périmé est le cas le plus banal ici.
   */
  it('annonce l’échec plutôt que de rester à moitié vide', async () => {
    mockRoutes({
      '/trips/': () =>
        jsonResponse({ code: 'NOT_FOUND', message: 'Départ introuvable.' }, 404),
    })

    render(<TripPage />, { route: '/trips/TR-INCONNU' })

    expect(await screen.findByText(/introuvable/i)).toBeInTheDocument()
  })
  /**
   * **Le message d'erreur suit la langue choisie.**
   *
   * `describeError` la lisait une seule fois, au chargement du module, et depuis
   * `navigator.language` — jamais depuis le choix de l'utilisateur. Quelqu'un qui
   * bascule en anglais continuait donc de lire ses erreurs en français, et rien à
   * l'écran ne reliait les deux. Le défaut restait invisible tant qu'aucune
   * erreur ne survenait, ce qui est précisément le cas où l'on a besoin de
   * comprendre.
   */
  it('dit l’échec dans la langue choisie', async () => {
    mockRoutes({
      '/trips/': () => jsonResponse({ code: 'NOT_FOUND', message: 'diagnostic' }, 404),
    })

    await i18next.changeLanguage('en')

    render(<TripPage />, { route: '/trips/TR-INCONNU' })

    expect(await screen.findByText(/not found/i)).toBeInTheDocument()
    expect(screen.queryByText(/introuvable/i)).not.toBeInTheDocument()
  })
})
