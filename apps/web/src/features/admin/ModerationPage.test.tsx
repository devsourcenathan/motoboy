import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { ModerationPage } from './ModerationPage'

/**
 * La modération du référentiel.
 *
 * Elle ne paraît pas critique, et elle l'est : c'est **la recherche** qui en
 * dépend. Trois orthographes de Bafoussam, et un passager ne trouve pas le départ
 * qui existe.
 */
const routes = (extra: Record<string, () => Response> = {}) => ({
  ...extra,
  '/admin/city-requests': () =>
    jsonResponse({
      data: [{ id: 7, requested_name: 'Bafoussam', agency: 'Général Express' }],
    }),
  '/admin/stations': () =>
    jsonResponse({
      data: [{ id: 3, name: 'Gare de Bonabéri', city: 'Douala', is_active: true }],
    }),
})

describe('ModerationPage', () => {
  /**
   * **Le test qui compte.** Approuver exige de désigner la ville du référentiel
   * qui répond à la demande : l'agence a écrit un nom libre. Sans ce
   * rattachement, on créerait la seconde Douala que cette page existe pour
   * empêcher — le bouton reste donc inerte tant que rien n'est saisi.
   */
  it('refuse d’approuver une ville sans la rattacher au référentiel', async () => {
    mockRoutes(routes())

    render(<ModerationPage />)

    expect(await screen.findByRole('button', { name: 'Approuver' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/Identifiant de la ville/), '12')

    expect(screen.getByRole('button', { name: 'Approuver' })).toBeEnabled()
  })

  it('transmet le rattachement choisi', async () => {
    mockRoutes(routes({ '/resolve': () => jsonResponse({ status: 'APPROVED' }) }))

    render(<ModerationPage />)

    await userEvent.type(await screen.findByLabelText(/Identifiant de la ville/), '12')
    await userEvent.click(screen.getByRole('button', { name: 'Approuver' }))

    expect(
      await sentRequest((request) => request.url.includes('/resolve')),
    ).toMatchObject({
      decision: 'APPROVE',
      city_id: 12,
    })
  })

  /**
   * **Rejeter n'exige rien.** Une demande sans suite n'a pas de ville à
   * désigner — imposer le champ obligerait à en inventer une pour dire non.
   */
  it('laisse rejeter sans rattachement', async () => {
    mockRoutes(routes({ '/resolve': () => jsonResponse({ status: 'REJECTED' }) }))

    render(<ModerationPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Rejeter' }))

    const sent = (await sentRequest((request) =>
      request.url.includes('/resolve'),
    )) as Record<string, unknown>

    expect(sent).toMatchObject({ decision: 'REJECT' })
    expect(sent).not.toHaveProperty('city_id')
  })

  /**
   * **Désactiver n'efface pas.** Une gare porte des départs passés et des billets
   * validés ; la supprimer emporterait leur historique. L'écran doit donc parler
   * de désactivation, jamais de suppression.
   */
  it('propose de désactiver une gare, pas de la supprimer', async () => {
    mockRoutes(routes())

    render(<ModerationPage />)

    expect(await screen.findByRole('button', { name: 'Désactiver' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Supprimer/ })).not.toBeInTheDocument()
  })
})
