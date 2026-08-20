import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { render } from '../../test/render'
import { AgencyLayout } from './AgencyLayout'

/**
 * Le cadre de l'espace agence.
 *
 * Il porte trois choses qu'aucune autre page ne porte : la navigation, le choix
 * de la langue et la déconnexion. Toutes trois sont visibles sur **chaque**
 * écran — une erreur ici se voit partout, ou nulle part.
 */
describe('AgencyLayout', () => {
  /**
   * Les onglets portent une clé traduite, pas un libellé écrit dans le fichier.
   * Basculer la langue doit donc renommer la barre entière — c'est le premier
   * endroit où une traduction manquante se verrait.
   */
  it('renomme la navigation avec la langue', async () => {
    render(<AgencyLayout onSignOut={vi.fn()} />)

    expect(await screen.findByRole('link', { name: 'Gares' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'English' }))

    expect(await screen.findByRole('link', { name: 'Stations' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Gares' })).not.toBeInTheDocument()
  })

  /**
   * **Le sélecteur de langue vit ici**, dans le bandeau, et non dans une page de
   * réglages : le personnel d'agence n'a pas à traverser un back-office
   * francophone pour trouver comment le quitter.
   */
  it('offre le choix de la langue depuis le bandeau', async () => {
    render(<AgencyLayout onSignOut={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Français' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
  })

  it('déconnecte sur demande', async () => {
    const onSignOut = vi.fn()

    render(<AgencyLayout onSignOut={onSignOut} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))

    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
