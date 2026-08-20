import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { PayoutAccountsPage } from './PayoutAccountsPage'

/**
 * La vérification des comptes de versement.
 *
 * **C'est le dernier contrôle humain avant qu'un virement parte.** Une fois le
 * compte vérifié, l'argent d'une agence s'y dirige sans que personne ne relise —
 * et un virement Mobile Money mal dirigé ne se récupère pas.
 */
const account = {
  id: 4,
  account_name: 'Général Express SARL',
  masked_number: '••••••001',
  operator: 'MTN',
  type: 'MOBILE_MONEY',
  status: 'PENDING',
  agency: 'Général Express',
}

const routes = (extra: Record<string, () => Response> = {}) => ({
  ...extra,
  '/admin/payout-accounts': () => jsonResponse({ data: [account] }),
})

describe('PayoutAccountsPage', () => {
  /**
   * **Le numéro reste masqué, y compris ici.** Le vérificateur compare un *nom*
   * de titulaire à un nom d'agence ; il n'a pas besoin du numéro complet, et le
   * lui montrer le ferait circuler dans une capture d'écran ou un message.
   */
  it('ne montre jamais le numéro en clair', async () => {
    mockRoutes(routes())

    render(<PayoutAccountsPage />)

    expect(await screen.findByText('••••••001')).toBeInTheDocument()
    expect(screen.queryByText(/690000001/)).not.toBeInTheDocument()
  })

  /**
   * **Le test qui compte.** Vérifier se fait en deux temps, et la confirmation
   * nomme le titulaire et l'agence : c'est exactement la comparaison qu'on
   * demande de faire. Un bouton unique laisserait valider d'un geste distrait.
   */
  it('demande de confronter le titulaire à l’agence avant de vérifier', async () => {
    mockRoutes(routes())

    render(<PayoutAccountsPage />)

    await userEvent.click(await screen.findByRole('button', { name: /Vérifier/ }))

    const confirmation = await screen.findByText(/est bien le compte de/)

    expect(confirmation).toHaveTextContent('Général Express SARL')
    expect(confirmation).toHaveTextContent('Général Express')
  })
})
