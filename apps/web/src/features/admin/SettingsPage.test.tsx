import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { SettingsPage } from './SettingsPage'

/**
 * Les réglages de la plateforme.
 *
 * Deux valeurs qui s'appliquent à tout le monde d'un coup. La conversion en
 * points de base est la seule chose qui puisse se tromper silencieusement — et
 * elle se tromperait d'un facteur cent.
 */
const settings = () => ({
  '/admin/settings': () =>
    jsonResponse({
      ride_commission_bps: 250,
      ride_commission_max_bps: 3000,
      id_document_mode: 'NUMBER',
      id_document_required: false,
    }),
})

describe('SettingsPage', () => {
  /**
   * **Le test qui compte : 2,5 % doit partir en 250, pas en 2,5.**
   *
   * La plateforme raisonne en points de base pour ne pas perdre un franc en
   * arrondi, personne ne raisonne ainsi, et l'écran traduit. Une traduction ratée
   * d'un facteur cent ne se voit pas à l'écran — elle se voit sur la première
   * facture d'un chauffeur.
   */
  it('convertit le pourcentage en points de base', async () => {
    mockRoutes({ '/ride-commission': () => jsonResponse({}), ...settings() })

    render(<SettingsPage />)

    const field = await screen.findByLabelText(/Pourcentage/)
    await userEvent.clear(field)
    await userEvent.type(field, '4,5')

    // Ce que l'écran annonce enregistrer, avant même d'envoyer.
    expect(screen.getByText(/450 points de base/)).toBeInTheDocument()

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Enregistrer' })[0] as HTMLElement,
    )

    expect(
      await sentRequest((request) => request.url.endsWith('/ride-commission')),
    ).toMatchObject({ commission_bps: 450 })
  })

  /**
   * Le maximum vient du serveur, pas d'une constante recopiée. Le dépasser doit
   * bloquer ici plutôt que de partir se faire refuser.
   */
  it('refuse une commission au-delà du maximum annoncé', async () => {
    mockRoutes(settings())

    render(<SettingsPage />)

    const field = await screen.findByLabelText(/Pourcentage/)
    await userEvent.clear(field)
    await userEvent.type(field, '45')

    expect(screen.getByText(/hors des bornes/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Enregistrer' })[0]).toBeDisabled()
  })

  /**
   * **Forme et obligation sont deux décisions.** Les confondre empêcherait de
   * recueillir une photographie de façon facultative — l'état le plus prudent
   * tant que la conservation n'est pas éprouvée.
   */
  it('sépare la forme de la pièce et son caractère obligatoire', async () => {
    mockRoutes({ '/id-documents': () => jsonResponse({}), ...settings() })

    render(<SettingsPage />)

    await userEvent.selectOptions(
      await screen.findByLabelText(/Forme recueillie/),
      'IMAGE',
    )
    await userEvent.click(screen.getByLabelText('Obligatoire pour réserver'))

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Enregistrer' })[1] as HTMLElement,
    )

    expect(
      await sentRequest((request) => request.url.endsWith('/id-documents')),
    ).toMatchObject({ id_document_mode: 'IMAGE', id_document_required: true })
  })
})
