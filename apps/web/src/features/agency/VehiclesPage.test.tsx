import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { VehiclesPage } from './VehiclesPage'

/**
 * Le parc de l'agence.
 *
 * **Le mode de placement décide si le passager choisit son siège**, et il ne se
 * change plus une fois des départs vendus. C'est la seule décision de cet écran
 * qu'on ne peut pas reprendre, donc la seule que les tests gardent.
 */
const vehicles = (rows: unknown[] = []) => ({
  '/agency/vehicles': () => jsonResponse({ data: rows }),
})

describe('VehiclesPage', () => {
  it('dit pourquoi un itinéraire sans véhicule ne produit rien', async () => {
    mockRoutes(vehicles())

    render(<VehiclesPage />)

    expect(await screen.findByText('Aucun véhicule')).toBeInTheDocument()
    expect(screen.getByText(/qu’avec un véhicule pour les assurer/)).toBeInTheDocument()
  })

  /**
   * **Le test qui compte.** Le formulaire explique ce que chaque mode engage
   * *avant* le choix — dont le fait qu'il ne se reprend pas. Nommer les modes
   * sans les expliquer ferait choisir au hasard une chose définitive.
   */
  it('explique ce que le mode de placement engage, avant de le choisir', async () => {
    mockRoutes(vehicles())

    render(<VehiclesPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ajouter un véhicule' }),
    )

    // `SEATED` est le mode par défaut : c'est donc son engagement qu'on lit
    // d'abord, y compris le fait qu'il ne se reprend pas.
    expect(
      screen.getByText(/Ne se change plus une fois des départs vendus/),
    ).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText(/Mode de placement/), 'CAPACITY')

    expect(screen.getByText(/Seul le nombre de places compte/)).toBeInTheDocument()
  })

  it('transmet le mode choisi et l’immatriculation', async () => {
    mockRoutes({ '/vehicles': () => jsonResponse({ id: 1 }), ...vehicles() })

    render(<VehiclesPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ajouter un véhicule' }),
    )
    await userEvent.type(screen.getByLabelText(/Immatriculation/), 'LT-4412-AB')
    await userEvent.clear(screen.getByLabelText(/Nombre de places/))
    await userEvent.type(screen.getByLabelText(/Nombre de places/), '30')
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter le véhicule' }))

    expect(
      await sentRequest(
        (request) => request.method === 'POST' && request.url.includes('/vehicles'),
      ),
    ).toMatchObject({ registration: 'LT-4412-AB', seating_mode: 'SEATED', capacity: 30 })
  })
  /**
   * **Une plaque mal saisie était définitive, et un bus vendu restait en
   * service** — donc porteur d'horaires, donc générateur de départs qu'aucun
   * véhicule ne ferait.
   *
   * Le placement et la capacité ne sont pas proposés : des départs vendus
   * portent déjà un plan de sièges. Les afficher grisés serait pire que les
   * omettre — on chercherait comment les débloquer.
   */
  it('corrige un véhicule sans proposer d’en changer le placement', async () => {
    mockRoutes({
      '/agency/vehicles': () =>
        jsonResponse({
          data: [
            {
              id: 4,
              registration: 'LT-000',
              type: 'BUS',
              seating_mode: 'SEATED',
              capacity: 30,
              condition: 'ACTIVE',
            },
          ],
        }),
      '/vehicles/4': () => jsonResponse({ id: 4, registration: 'LT-123-AB' }),
    })

    render(<VehiclesPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }))

    expect(screen.queryByLabelText(/Placement/)).toBeNull()
    expect(screen.queryByLabelText(/Nombre de sièges/)).toBeNull()

    await userEvent.selectOptions(screen.getByLabelText('État'), 'RETIRED')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(
      await sentRequest((request) => request.url.includes('/vehicles/4')),
    ).toMatchObject({ condition: 'RETIRED' })
  })
})
