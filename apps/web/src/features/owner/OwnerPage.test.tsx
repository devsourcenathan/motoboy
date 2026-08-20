import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { OwnerPage } from './OwnerPage'

/**
 * L'espace du propriétaire de véhicule.
 *
 * **Il ne peut rien y faire, et c'est le sujet.** Il constate le remplissage de
 * ses véhicules ; sa rémunération se règle avec l'agence, hors plateforme.
 * L'écran doit donc être clair sur ce qu'il n'est pas, sinon il attend un
 * versement qui ne viendra jamais d'ici.
 */
describe('OwnerPage', () => {
  /**
   * Un propriétaire sans véhicule ne s'est pas trompé de compte : c'est l'agence
   * qui doit le rattacher. Le dire évite un appel au support qui ne peut rien.
   */
  it('explique qui rattache un véhicule quand il n’y en a aucun', async () => {
    mockRoutes({ '/owner/vehicles': () => jsonResponse({ data: [] }) })

    render(<OwnerPage />)

    expect(await screen.findByText('Aucun véhicule')).toBeInTheDocument()
    expect(screen.getByText(/rattache un véhicule par votre numéro/)).toBeInTheDocument()
  })

  /**
   * **La rémunération est dite hors plateforme.** Sans cette phrase, un
   * propriétaire attendrait un virement de MOTOBOY et ne réclamerait rien à son
   * agence.
   */
  it('dit que la rémunération se règle avec l’agence', async () => {
    mockRoutes({ '/owner/vehicles': () => jsonResponse({ data: [] }) })

    render(<OwnerPage />)

    expect(
      await screen.findByText(/rémunération se règle directement avec l’agence/),
    ).toBeInTheDocument()
  })
})
