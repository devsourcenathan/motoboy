import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { render } from '../../test/render'
import { NotFoundPage } from './NotFoundPage'

/**
 * L'adresse qui ne mène nulle part.
 *
 * Il n'y avait pas de route attrape-tout : une URL inconnue rendait une page
 * **entièrement blanche**, indistinguable d'une panne et sans rien pour repartir.
 * Un lien de départ partagé puis périmé est pourtant le cas le plus banal ici.
 */
describe('NotFoundPage', () => {
  it('dit ce qui s’est passé et offre une issue', async () => {
    render(<NotFoundPage />)

    expect(await screen.findByText('Cette page n’existe pas')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revenir à la recherche' })).toHaveAttribute(
      'href',
      '/',
    )
  })
})
