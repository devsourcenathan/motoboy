import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { DocumentsPage } from './DocumentsPage'

/**
 * Les pièces de l'agence.
 *
 * Le premier envoi de fichier du web, et deux choses y méritent d'être
 * verrouillées : ce qui part réellement au serveur, et ce qui est refusé avant
 * de partir.
 */
const file = (name: string, bytes: number) =>
  new File([new Uint8Array(bytes)], name, { type: 'application/pdf' })

const routes = () => ({ '/agency/documents': () => jsonResponse({ data: [] }) })

describe('DocumentsPage', () => {
  /**
   * **La taille est vérifiée avant l'envoi.** Huit mégaoctets sur une connexion
   * de gare mettent une minute à monter pour être refusés à l'arrivée — autant le
   * dire tout de suite, et retenir le bouton.
   */
  it('refuse un fichier trop lourd sans l’envoyer', async () => {
    mockRoutes(routes())

    render(<DocumentsPage />)

    await userEvent.upload(
      await screen.findByLabelText(/Fichier/),
      file('registre.pdf', 9 * 1024 * 1024),
    )

    expect(screen.getByText(/dépasse 8 Mo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Déposer' })).toBeDisabled()
  })

  /**
   * **Le fichier part en multipart, avec sa frontière.**
   *
   * C'est ce que le serveur doit pouvoir découper, et la seule propriété de
   * l'envoi qui puisse silencieusement mal tourner : un corps encodé en JSON y
   * mettrait `[object File]` et l'API répondrait « file must be a file » sans
   * jamais nommer l'encodage.
   */
  it('envoie un multipart que le serveur saura découper', async () => {
    mockRoutes({ ...routes(), '/documents': () => jsonResponse({ id: 1 }) })

    render(<DocumentsPage />)

    await userEvent.upload(
      await screen.findByLabelText(/Fichier/),
      file('registre.pdf', 1024),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Déposer' }))

    const posts = () =>
      (fetch as unknown as { mock: { calls: [Request | string][] } }).mock.calls
        .map(([input]) => input)
        .filter(
          (input): input is Request =>
            typeof input !== 'string' && input.method === 'POST',
        )

    /*
     * `toBeGreaterThan(0)` et le **dernier** appel, pas `toHaveLength(1)` et le
     * premier : la liste d'appels du mock persiste d'un test à l'autre dans le
     * même fichier. Compter les POST absolus ferait dépendre ce test de ceux qui
     * le précèdent.
     */
    await waitFor(() => expect(posts().length).toBeGreaterThan(0))

    const post = posts()[posts().length - 1] as Request

    /*
     * **L'en-tête plutôt que le corps, et c'est même plus probant.**
     *
     * `Request.formData()` ne se résout jamais sous jsdom — le test s'y bloquait
     * jusqu'à expiration. Mais la frontière multipart n'apparaît que si le corps
     * *est* un `FormData` : cet en-tête prouve donc à la fois que le sérialiseur
     * n'a pas encodé en JSON — ce qui aurait envoyé `[object File]` — et que le
     * serveur aura de quoi découper.
     */
    expect(post.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/)
  })

  /**
   * **Nommer l'absence.** Une ligne manquante se lit comme un oubli d'affichage,
   * pas comme une pièce à fournir — et une agence attend alors une admission que
   * rien ne fera avancer.
   */
  it('nomme les pièces qui manquent, pas seulement celles déposées', async () => {
    mockRoutes({
      '/agency/documents': () =>
        jsonResponse({ data: [{ id: 1, type: 'REGISTRATION', status: 'PENDING' }] }),
    })

    render(<DocumentsPage />)

    /*
     * Attendre « Non déposée » et non le nom d'une pièce : celui-ci figure aussi
     * dans le sélecteur du formulaire, présent dès le premier rendu. L'attente
     * se serait résolue avant l'arrivée des données, et l'assertion suivante
     * aurait porté sur un tableau pas encore là.
     */
    expect((await screen.findAllByText('Non déposée')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Licence de transport').length).toBeGreaterThan(0)
  })
})
