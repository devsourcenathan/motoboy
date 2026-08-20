import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { StaffPage } from './StaffPage'

/**
 * Le personnel de l'agence.
 *
 * **Le choix du profil donne ou refuse le droit d'encaisser.** C'est le seul
 * endroit de l'espace agence où une erreur de clic a une conséquence financière,
 * et c'est donc ce que les tests protègent : que les deux profils soient
 * distincts, expliqués, et que retirer quelqu'un ne se fasse pas d'un seul geste.
 */
const staff = (...rows: unknown[]) => jsonResponse({ data: rows })

const agent = {
  user_id: 1,
  first_name: 'Awa',
  last_name: 'Nkeng',
  phone: '+237690000001',
  role: 'AGENT',
  is_active: true,
}

describe('StaffPage', () => {
  it('invite à ajouter quelqu’un quand l’équipe est vide', async () => {
    mockRoutes({ '/agency/staff': () => staff() })

    render(<StaffPage />)

    expect(await screen.findByText('Aucun membre du personnel')).toBeInTheDocument()
  })

  /**
   * Une agence ne connaît pas `AGENT` : elle connaît des gens qui embarquent.
   * Afficher le nom technique ferait choisir au hasard.
   */
  it('nomme les profils en clair, pas par leur rôle technique', async () => {
    mockRoutes({ '/agency/staff': () => staff(agent) })

    render(<StaffPage />)

    expect(await screen.findByText('Agent d’embarquement')).toBeInTheDocument()
    expect(screen.queryByText('AGENT')).not.toBeInTheDocument()
  })

  /**
   * **Le test qui compte.** Le profil choisi décide du droit de vendre : envoyer
   * le mauvais donnerait à un agent d'embarquement la capacité d'encaisser.
   */
  it('envoie le profil choisi, et explique ce qu’il permet', async () => {
    mockRoutes({ '/agency/staff': () => staff() })

    render(<StaffPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ajouter quelqu’un' }),
    )

    // Le profil par défaut est le plus restreint.
    expect(screen.getByText(/Ne peut pas vendre/)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Prénom'), 'Jean')
    await userEvent.type(screen.getByLabelText('Nom'), 'Kamdem')
    await userEvent.type(screen.getByLabelText(/Téléphone/), '+237690000002')
    await userEvent.selectOptions(screen.getByLabelText(/Profil/), 'COUNTER')

    expect(screen.getByText(/vend au comptoir/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(await sentRequest((request) => request.method === 'POST')).toMatchObject({
      role: 'COUNTER',
    })
  })

  /**
   * Retirer quelqu'un demande une confirmation, et celle-ci dit ce qui survit :
   * sans cette phrase, une agence hésite à retirer un départ de peur d'effacer
   * ses ventes.
   */
  it('demande confirmation avant de retirer, en disant ce qui reste', async () => {
    mockRoutes({ '/agency/staff': () => staff(agent) })

    render(<StaffPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Retirer' }))

    expect(screen.getByText(/ventes restent à son nom/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeInTheDocument()
  })
})
