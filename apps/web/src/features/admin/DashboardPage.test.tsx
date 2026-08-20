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
    trips: { upcoming: 12 },
    bookings: { confirmed: 30, cancelled: 2 },
    tickets_validated: 28,
    vehicles_active: 6,
    revenue: { amount: 500000, currency: 'XAF' },
    commissions: { amount: 50000, currency: 'XAF' },
    refunds: { amount: 11000, currency: 'XAF' },
    payouts_pending: { amount: 0, currency: 'XAF' },
    ...over,
  })

const urgency = (label: string) =>
  screen.getByText(label).parentElement?.querySelector('p:last-of-type')?.className ?? ''

describe('DashboardPage', () => {
  /**
   * **L'orange dit « votre action », et seulement elle.** Un compteur à zéro
   * n'attend rien : le colorer crierait sans rien demander, et la couleur
   * cesserait de vouloir dire quelque chose.
   */
  it('ne signale pas une file vide', async () => {
    mockRoutes({ '/admin/dashboard': () => dashboard() })

    render(<DashboardPage />)

    await screen.findByText('Agences à instruire')

    expect(urgency('Agences à instruire')).not.toMatch(/orange/)
  })

  it('signale une file qui attend', async () => {
    mockRoutes({
      '/admin/dashboard': () =>
        dashboard({ agencies: { total: 5, pending: 2, approved: 3 } }),
    })

    render(<DashboardPage />)

    await screen.findByText('Agences à instruire')

    expect(urgency('Agences à instruire')).toMatch(/orange/)
  })

  /**
   * **Les remboursements à côté de l'encaissé, jamais soustraits.** Deux nombres
   * qui bougent pour des raisons différentes : n'en montrer que la différence
   * cacherait une hausse des annulations derrière une hausse des ventes.
   */
  it('montre le remboursé sans le retrancher de l’encaissé', async () => {
    mockRoutes({ '/admin/dashboard': () => dashboard() })

    render(<DashboardPage />)

    expect(await screen.findByText('Encaissé')).toBeInTheDocument()
    expect(screen.getByText('Remboursé')).toBeInTheDocument()
  })

  /**
   * La lacune est écrite sur la page : l'API ne compte pas les dossiers de
   * chauffeur, et c'est pourquoi cet écran n'est pas l'accueil du back-office.
   */
  it('avoue ne pas compter les chauffeurs', async () => {
    mockRoutes({ '/admin/dashboard': () => dashboard() })

    render(<DashboardPage />)

    expect(
      await screen.findByText(/dossiers de chauffeur ne sont pas comptés/),
    ).toBeInTheDocument()
  })
})
