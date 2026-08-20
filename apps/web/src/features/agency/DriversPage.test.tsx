import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { DriversPage } from './DriversPage'

/**
 * Les chauffeurs salariés d'une agence.
 *
 * **MOTOBOY ne les modère pas.** Contrairement aux chauffeurs indépendants, dont
 * la plateforme relit le permis, ceux-ci relèvent entièrement de l'agence — et
 * l'écran doit le dire, faute de quoi une agence croit qu'un contrôle a eu lieu.
 */
const drivers = (rows: unknown[] = []) => ({
  '/agency/drivers': () => jsonResponse({ data: rows }),
  '/agency/vehicles': () => jsonResponse({ data: [{ id: 5, registration: 'LT-1' }] }),
})

describe('DriversPage', () => {
  it('dit que la plateforme ne relit pas ces permis', async () => {
    mockRoutes(drivers())

    render(<DriversPage />)

    expect(await screen.findByText(/MOTOBOY ne les modère pas/)).toBeInTheDocument()
  })

  /**
   * **Le véhicule habituel est facultatif, et l'omission doit être propre.**
   * Envoyer une chaîne vide là où l'API attend un identifiant ferait échouer la
   * création pour un champ que l'agence avait le droit de laisser libre.
   */
  it('n’envoie pas de véhicule quand aucun n’est choisi', async () => {
    mockRoutes({ '/drivers': () => jsonResponse({ id: 1 }), ...drivers() })

    render(<DriversPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ajouter un chauffeur' }),
    )
    await userEvent.type(screen.getByLabelText(/Prénom/), 'Awa')
    await userEvent.type(screen.getByLabelText(/^Nom/), 'Nkeng')
    await userEvent.type(screen.getByLabelText(/Téléphone/), '+237690000001')
    await userEvent.type(screen.getByLabelText(/Numéro de permis/), 'CM-99')
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter le chauffeur' }))

    const sent = (await sentRequest(
      (request) => request.method === 'POST' && request.url.includes('/drivers'),
    )) as Record<string, unknown>

    expect(sent).toMatchObject({ license_number: 'CM-99' })
    expect(sent).not.toHaveProperty('assigned_vehicle_id')
  })
})
