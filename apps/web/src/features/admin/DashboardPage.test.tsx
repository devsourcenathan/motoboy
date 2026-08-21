import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { DashboardPage } from './DashboardPage'

/**
 * Le tableau de bord.
 *
 * Sa seule fonction est de séparer **ce qui attend une décision** de ce qui ne
 * fait que décrire. Mêlés dans une grille uniforme, les deux obligent à relire
 * chaque case pour retrouver celle qui demande quelque chose.
 */
const dashboard = (over: Record<string, unknown> = {}) =>
  jsonResponse({
    users: 120,
    agencies: { total: 4, pending: 0, approved: 4 },
    trips: { upcoming: 12, cancelled_30d: 0 },
    bookings: { confirmed: 30, cancelled: 2 },
    tickets_validated: 28,
    vehicles_active: 6,
    revenue: { amount: 500000, currency: 'XAF' },
    commissions: { amount: 50000, currency: 'XAF' },
    refunds: { amount: 11000, currency: 'XAF' },
    payouts_pending: { amount: 0, currency: 'XAF' },
    ...over,
  })

const routes = (over: Record<string, unknown> = {}) => ({
  '/admin/dashboard': () => dashboard(over),
  // Le panneau d'activité récente lit le journal d'audit : sans cette route,
  // c'est son échec qu'on testerait.
  '/admin/audit-logs': () => jsonResponse({ data: [] }),
})

describe('DashboardPage', () => {
  /**
   * **Un compteur qui appelle une décision doit mener à l'écran où on la
   * prend.** Sans cela il faut retrouver l'onglet soi-même, et l'on finit par
   * ne plus ouvrir cette page — ce qui est la pire chose qui puisse arriver à
   * un tableau de bord.
   *
   * Éprouvé sur le lien plutôt que sur la couleur : l'ancienne version de ce
   * test cherchait la chaîne « orange » dans une classe, ce qui la liait à
   * `text-orange-500` — une couleur brute, hors du système de jetons. Le test
   * défendait l'entorse.
   */
  it('mène à la file quand elle attend', async () => {
    mockRoutes(routes({ agencies: { total: 5, pending: 2, approved: 3 } }))

    render(<DashboardPage />)

    const carte = await screen.findByRole('link', { name: /Agences à instruire/ })

    expect(carte).toHaveAttribute('href', '/admin/agencies')
  })

  /**
   * **Un compteur à zéro n'attend rien.** En faire un lien enverrait sur une
   * file vide, et l'y envoyer deux fois suffit à ne plus cliquer.
   */
  it('ne mène nulle part quand la file est vide', async () => {
    mockRoutes(routes())

    render(<DashboardPage />)

    await screen.findByText('Agences à instruire')

    expect(screen.queryByRole('link', { name: /Agences à instruire/ })).toBeNull()
  })

  /**
   * **L'API comptait ces annulations et rien ne les affichait.** Une agence qui
   * annule un départ sur cinq détruit la confiance dans la plateforme entière,
   * pas seulement dans sa propre offre : le chiffre existait, invisible.
   */
  it('montre les départs annulés, que rien n’affichait', async () => {
    mockRoutes(routes({ trips: { upcoming: 12, cancelled_30d: 3 } }))

    render(<DashboardPage />)

    const carte = (await screen.findByText(/Départs annulés/)).closest('dl')

    expect(carte).toHaveTextContent('3')
  })

  /**
   * **Les remboursements à côté de l'encaissé, jamais soustraits.** Deux nombres
   * qui bougent pour des raisons différentes : n'en montrer que la différence
   * cacherait une hausse des annulations derrière une hausse des ventes.
   */
  it('montre le remboursé sans le retrancher de l’encaissé', async () => {
    mockRoutes(routes())

    render(<DashboardPage />)

    expect(await screen.findByText('Encaissé')).toBeInTheDocument()
    expect(screen.getByText('Remboursé')).toBeInTheDocument()
  })

  /**
   * La lacune est écrite sur la page : l'API ne compte pas les dossiers de
   * chauffeur, et c'est pourquoi cet écran n'est pas l'accueil du back-office.
   */
  it('avoue ne pas compter les chauffeurs', async () => {
    mockRoutes(routes())

    render(<DashboardPage />)

    expect(
      await screen.findByText(/dossiers de chauffeur ne sont pas comptés/),
    ).toBeInTheDocument()
  })
})
