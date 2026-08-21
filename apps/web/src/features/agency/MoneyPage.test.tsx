import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { MoneyPage } from './MoneyPage'

/**
 * Le compte de l'agence.
 *
 * **C'est la seule page du produit où une faute de frappe envoie de l'argent à un
 * inconnu.** La page le dit elle-même : un virement Mobile Money mal dirigé ne se
 * récupère pas. Les tests portent donc sur ce qui part vers le serveur, jamais
 * sur la mise en page.
 */
const routes = (extra: Record<string, () => Response> = {}) => ({
  '/agency/payout-accounts': () => jsonResponse({ data: [] }),
  '/agency/payouts': () => jsonResponse({ data: [] }),
  '/agency/ledger': () => jsonResponse({ data: [] }),
  /*
   * `extra` en **dernier** : posé en premier, il se faisait écraser par les
   * routes par défaut, si bien qu'un test qui croyait remplacer une réponse
   * obtenait l'autre — sans erreur, et en passant pour la mauvaise raison.
   */
  ...extra,
})

describe('MoneyPage', () => {
  /**
   * **Sans compte vérifié, aucun reversement ne peut partir.** Le taire laisserait
   * une agence attendre un versement que rien ne déclenchera jamais.
   */
  it('dit qu’aucun reversement ne partira tant qu’aucun compte n’est vérifié', async () => {
    mockRoutes(routes())

    render(<MoneyPage />)

    expect(await screen.findByText(/Aucun compte vérifié/)).toBeInTheDocument()
  })

  /**
   * **Le test qui compte.** Le numéro et le titulaire partent tels qu'ils ont été
   * saisis, débarrassés des espaces de bord. Un espace en fin de numéro suffit à
   * faire refuser le compte par l'opérateur — ou, pire, à le faire accepter tel
   * quel par une passerelle indulgente.
   */
  it('transmet le numéro et le titulaire sans espaces parasites', async () => {
    mockRoutes(routes({ '/payout-accounts': () => jsonResponse({ status: 'PENDING' }) }))

    render(<MoneyPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: /Déclarer un compte/ }),
    )

    await userEvent.type(await screen.findByLabelText(/Numéro/), '  690000001  ')
    await userEvent.type(screen.getByLabelText(/Nom du titulaire/), ' Général Express ')
    await userEvent.click(screen.getByRole('button', { name: /Déclarer ce compte/ }))

    expect(
      await sentRequest(
        // La méthode, pas seulement l'URL : le GET de la liste la partage, et une
        // lecture part toujours avant l'écriture qu'on veut examiner.
        (request) =>
          request.method === 'POST' && request.url.includes('/payout-accounts'),
      ),
    ).toMatchObject({
      type: 'MOBILE_MONEY',
      operator: 'MTN',
      account_number: '690000001',
      account_name: 'Général Express',
    })
  })

  /**
   * **Un compte bancaire n'a pas d'opérateur.** En envoyer un le rendrait
   * incohérent côté serveur, et le champ n'a même pas de sens à l'écran : on ne
   * choisit pas MTN pour un virement bancaire.
   */
  it('n’envoie pas d’opérateur pour un compte bancaire', async () => {
    mockRoutes(routes({ '/payout-accounts': () => jsonResponse({ status: 'PENDING' }) }))

    render(<MoneyPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: /Déclarer un compte/ }),
    )

    await userEvent.selectOptions(await screen.findByLabelText(/Type/), 'BANK')

    // Le sélecteur d'opérateur disparaît, il ne se contente pas d'être ignoré.
    expect(screen.queryByLabelText(/Opérateur/)).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Numéro/), 'CM211000')
    await userEvent.type(screen.getByLabelText(/Nom du titulaire/), 'Général Express')
    await userEvent.click(screen.getByRole('button', { name: /Déclarer ce compte/ }))

    const sent = (await sentRequest(
      (request) => request.method === 'POST' && request.url.includes('/payout-accounts'),
    )) as Record<string, unknown>

    expect(sent).not.toHaveProperty('operator')
    expect(sent).toMatchObject({ type: 'BANK' })
  })
})
