import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { AgencyLayout } from './AgencyLayout'

const agency = (status: string) => ({
  '/v1/agency': () =>
    jsonResponse({ reference: 'AG-001', name: 'Général Express', status }),
})

/**
 * Le cadre de l'espace agence.
 *
 * Il porte trois choses qu'aucune autre page ne porte : la navigation, le choix
 * de la langue et la déconnexion. Toutes trois sont visibles sur **chaque**
 * écran — une erreur ici se voit partout, ou nulle part.
 */
describe('AgencyLayout', () => {
  /**
   * **Une agence en attente ne savait pas qu'elle l'était.** Elle entre
   * désormais dans son espace sans attendre l'admission : elle déclare ses
   * gares, génère ses départs — et ne les trouve pas dans la recherche. Sans
   * explication, elle recommence, puis conclut à une panne.
   */
  it('dit à une agence en attente ce qui est ouvert et ce qui attend', async () => {
    mockRoutes(agency('PENDING'))

    render(<AgencyLayout onSignOut={vi.fn()} />)

    expect(
      await screen.findByText(/dossier est en cours d’instruction/),
    ).toBeInTheDocument()
    expect(screen.getByText(/n’apparaîtront dans la recherche/)).toBeInTheDocument()
  })

  /** Une agence admise n'a rien à lire : la bande disparaît. */
  it('n’avertit pas une agence admise', async () => {
    mockRoutes(agency('APPROVED'))

    render(<AgencyLayout onSignOut={vi.fn()} />)

    expect(await screen.findByText('Général Express')).toBeInTheDocument()
    expect(screen.queryByText(/en cours d’instruction/)).toBeNull()
  })

  /**
   * Le bandeau annonçait « MOTOBOY — agence » à tout le monde : aucun endpoint
   * ne rendait à une agence son propre nom.
   */
  it('nomme l’agence dans son bandeau', async () => {
    mockRoutes(agency('APPROVED'))

    render(<AgencyLayout onSignOut={vi.fn()} />)

    expect(await screen.findByText('Général Express')).toBeInTheDocument()
    expect(screen.getByText('AG-001')).toBeInTheDocument()
  })

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
