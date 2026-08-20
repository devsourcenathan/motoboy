import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { BoardingScannerPage } from './BoardingScannerPage'

/**
 * L'embarquement sur le quai.
 *
 * Ce que les tests protègent : **qu'on puisse valider sans réseau**, et qu'une
 * validation faite hors ligne ne se perde pas. Les deux sont invisibles au
 * moment où ils échouent — l'agent voit un écran normal, et le compte ne
 * s'aperçoit que le soir.
 */
const boardingList = () =>
  jsonResponse({
    trip: { reference: 'TR-001' },
    generated_at: '2026-08-18T06:00:00Z',
    passengers: [
      {
        ticket_reference: 'TCK-AAA111',
        passenger_name: 'Awa Nkeng',
        seat_label: 'A1',
        status: 'VALID',
      },
      {
        ticket_reference: 'TCK-BBB222',
        passenger_name: 'Jean Kamdem',
        seat_label: 'A2',
        status: 'USED',
      },
    ],
  })

const routes = { '/boarding-list': boardingList }

/*
 * Une expression plutôt qu'un texte exact : jsdom n'a pas `BarcodeDetector`, donc
 * le champ affiche son indice « cet appareil ne sait pas lire les QR », qui entre
 * dans le libellé accessible. C'est le comportement voulu sur un poste sans
 * caméra — le test doit le tolérer, pas le contredire.
 */
async function downloadList() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Télécharger la liste' }),
  )
  await screen.findByText(/copie de/)
}

describe('BoardingScannerPage', () => {
  it('demande la liste avant de laisser valider', async () => {
    mockRoutes(routes)

    render(<BoardingScannerPage />, { route: '/boarding?trip=TR-001' })

    expect(await screen.findByText(/Téléchargez la liste au bureau/)).toBeInTheDocument()
  })

  /**
   * **Le cœur du dispositif.** La décision se prend contre la copie locale, sans
   * aucun appel : le wifi d'une gare est absent ou ment, et un embarquement qui
   * dépend du serveur s'arrête au premier trou avec cinquante personnes qui
   * attendent.
   */
  it('valide un billet sans toucher au réseau', async () => {
    mockRoutes(routes)

    render(<BoardingScannerPage />, { route: '/boarding?trip=TR-001' })
    await downloadList()

    const callsBefore = (fetch as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length

    await userEvent.type(screen.getByLabelText(/Saisie manuelle/), 'TCK-AAA111')
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))

    expect(await screen.findByText('Montez')).toBeInTheDocument()
    expect(screen.getByText('Awa Nkeng')).toBeInTheDocument()

    // Aucune requête de plus : la validation est locale.
    expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(
      callsBefore,
    )
  })

  it('refuse un billet qui n’est pas sur ce départ', async () => {
    mockRoutes(routes)

    render(<BoardingScannerPage />, { route: '/boarding?trip=TR-001' })
    await downloadList()

    await userEvent.type(screen.getByLabelText(/Saisie manuelle/), 'TCK-ZZZ999')
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))

    expect(await screen.findByText('Pas sur ce départ')).toBeInTheDocument()
  })

  /**
   * Déjà embarqué n'est ni un oui ni un refus : ce peut être un double scan comme
   * un second passager avec le même billet. L'écran invite à regarder plutôt que
   * de trancher à la place de l'agent.
   */
  it('distingue un billet déjà passé d’un refus', async () => {
    mockRoutes(routes)

    render(<BoardingScannerPage />, { route: '/boarding?trip=TR-001' })
    await downloadList()

    await userEvent.type(screen.getByLabelText(/Saisie manuelle/), 'TCK-BBB222')
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))

    expect(await screen.findByText('Déjà embarqué')).toBeInTheDocument()
  })

  /**
   * La file est ce qui remonte au réseau. Si elle ne grandit pas, la validation
   * n'existe que sur cet écran — et disparaît avec lui.
   */
  it('empile la validation en attente d’envoi', async () => {
    mockRoutes(routes)

    render(<BoardingScannerPage />, { route: '/boarding?trip=TR-001' })
    await downloadList()

    await userEvent.type(screen.getByLabelText(/Saisie manuelle/), 'TCK-AAA111')
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))

    /*
     * Le compteur est coupé par l'interpolation JSX : on repère le paragraphe par
     * sa fin, puis on lit son contenu entier.
     */
    const line = await screen.findByText(/en attente d’envoi/)

    expect(line.textContent).toMatch(/^1\s*validation/)
  })

  /**
   * La synchronisation envoie **un lot**, et purge par `client_id` : envoyer une
   * par une multiplierait les allers-retours sur la pire connexion du parcours.
   */
  it('remonte la file en un seul envoi', async () => {
    mockRoutes({
      '/validations': () =>
        jsonResponse({
          results: [
            { client_id: 'inconnu', ticket_reference: 'TCK-AAA111', status: 'ACCEPTED' },
          ],
        }),
      '/boarding-list': boardingList,
    })

    render(<BoardingScannerPage />, { route: '/boarding?trip=TR-001' })
    await downloadList()

    await userEvent.type(screen.getByLabelText(/Saisie manuelle/), 'TCK-AAA111')
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Synchroniser' }))

    const mock = fetch as unknown as { mock: { calls: [Request | string][] } }

    await waitFor(async () => {
      const sent = mock.mock.calls
        .map(([input]) => input)
        .find((input) => typeof input !== 'string' && input.url.includes('/validations'))

      expect(sent).toBeDefined()

      const body = JSON.parse(await (sent as Request).clone().text()) as {
        validations: unknown[]
      }

      expect(body.validations).toHaveLength(1)
    })
  })
})
