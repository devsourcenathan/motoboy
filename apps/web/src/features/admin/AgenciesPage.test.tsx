import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { AgenciesPage } from './AgenciesPage'

/**
 * L'admission des agences.
 *
 * C'est la porte d'entrée de la plateforme : une agence admise vend des places et
 * encaisse de l'argent. Les tests protègent donc ce qui rend une décision
 * réversible ou informée, pas la mise en page.
 */
const pending = {
  reference: 'AG-001',
  name: 'Général Express',
  legal_name: 'Général Express SARL',
  phone: '+237690000001',
  status: 'PENDING',
  documents_count: 2,
  has_verified_payout_account: false,
}

const listOnly = () => ({
  '/admin/agencies': () => jsonResponse({ data: [pending] }),
})

/*
 * **Du plus précis au plus général.** `mockRoutes` retient le premier motif
 * contenu dans l'URL : placer `/admin/agencies` en tête lui ferait intercepter la
 * fiche et les décisions, et le test vérifierait la liste en croyant vérifier
 * autre chose.
 */
const withDetail = () => ({
  '/admin/agencies/AG-001': () =>
    jsonResponse({
      name: 'Général Express',
      status: 'PENDING',
      documents: [{ id: 1, type: 'TRADE_REGISTER', status: 'PENDING', expires_at: null }],
    }),
  ...listOnly(),
})

describe('AgenciesPage', () => {
  it('invite à instruire quand la file est vide', async () => {
    mockRoutes({ '/admin/agencies': () => jsonResponse({ data: [] }) })

    render(<AgenciesPage />)

    expect(await screen.findByText('Aucune agence dans cette file')).toBeInTheDocument()
  })

  /**
   * **Un compte de reversement non vérifié n'empêche pas d'admettre, mais empêche
   * de payer.** Le taire ferait admettre une agence qu'on ne pourra pas régler, et
   * la découverte se ferait au premier reversement dû.
   */
  it('dit ce qui manque avant de proposer d’admettre', async () => {
    mockRoutes(listOnly())

    render(<AgenciesPage />)

    expect(
      await screen.findByText('Aucun compte de reversement vérifié'),
    ).toBeInTheDocument()
  })

  /**
   * **Le test qui compte.** Un refus sans motif ferait redéposer le même dossier :
   * l'agence ne saurait pas quoi corriger. Le bouton reste donc inerte tant que
   * rien n'est écrit.
   */
  it('refuse de rejeter sans motif, puis l’envoie', async () => {
    mockRoutes({ '/reject': () => jsonResponse({ status: 'REJECTED' }), ...withDetail() })

    render(<AgenciesPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ouvrir le dossier' }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Refuser' }))

    const confirm = screen.getByRole('button', { name: 'Confirmer le refus' })
    expect(confirm).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/Motif du refus/), 'Registre illisible')
    expect(confirm).toBeEnabled()

    await userEvent.click(confirm)

    expect(await sentRequest((request) => request.url.endsWith('/reject'))).toMatchObject(
      {
        reason: 'Registre illisible',
      },
    )
  })

  /**
   * L'admission, elle, n'a rien à justifier — et n'envoie donc pas de corps. Lui
   * en imposer un obligerait à inventer un motif pour dire oui.
   */
  it('admet sans exiger de justification', async () => {
    mockRoutes({
      '/approve': () => jsonResponse({ status: 'APPROVED' }),
      ...withDetail(),
    })

    render(<AgenciesPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ouvrir le dossier' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Admettre l’agence' }),
    )

    const sent = await sentRequest((request) => request.url.endsWith('/approve'))

    expect(sent).toBeNull()
  })
})
