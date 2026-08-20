import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { session } from '../../lib/api'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { SignInPage } from './SignInPage'

/**
 * La connexion au back-office.
 *
 * Elle n'a **aucun mot de passe** : l'identité tient au numéro, la preuve au code
 * reçu par SMS. Les tests portent donc sur la seule chose qui puisse mal tourner
 * — que le code vérifié soit celui du numéro auquel il a été envoyé.
 */
const routes = () => ({
  '/auth/otp/verify': () => jsonResponse({ token: 'jeton', user: { id: 1 } }),
  '/auth/login': () => jsonResponse({ expires_at: '2026-08-19T12:00:00Z' }),
})

describe('SignInPage', () => {
  it('demande un code avant de demander un code', async () => {
    mockRoutes(routes())

    render(<SignInPage />)

    expect(
      await screen.findByRole('button', { name: 'Recevoir un code' }),
    ).toBeInTheDocument()
    // Le champ de code n'existe pas encore : l'afficher vide inviterait à
    // inventer six chiffres.
    expect(screen.queryByLabelText(/Code/)).not.toBeInTheDocument()
  })

  /**
   * **Le test qui compte.** Le numéro se verrouille une fois le code parti. Le
   * laisser modifiable permettrait de recevoir un code sur son propre téléphone
   * puis de le soumettre au nom d'un autre numéro — et le serveur, qui vérifie le
   * couple, refuserait ; mais l'écran aurait laissé croire que c'était une chose
   * à tenter.
   */
  it('verrouille le numéro une fois le code envoyé', async () => {
    mockRoutes(routes())

    render(<SignInPage />)

    const phone = await screen.findByLabelText(/Téléphone/)
    await userEvent.type(phone, '+237690000001')
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir un code' }))

    expect(await screen.findByLabelText(/Code/)).toBeInTheDocument()
    expect(phone).toBeDisabled()
  })

  /**
   * Le code part avec le numéro auquel il a été envoyé, sans que l'écran ait à
   * les rapprocher : les deux viennent du même état.
   */
  it('vérifie le code contre le numéro qui l’a demandé', async () => {
    mockRoutes(routes())

    render(<SignInPage />)

    await userEvent.type(await screen.findByLabelText(/Téléphone/), '+237690000001')
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir un code' }))

    await userEvent.type(await screen.findByLabelText(/Code/), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(
      await sentRequest((request) => request.url.includes('/otp/verify')),
    ).toMatchObject({
      phone: '+237690000001',
      code: '123456',
    })
  })

  /**
   * Un code n'est fait que de chiffres. Filtrer à la saisie évite qu'un espace
   * collé depuis un SMS fasse échouer une vérification pourtant correcte.
   */
  it('ne retient que les chiffres du code', async () => {
    mockRoutes(routes())

    render(<SignInPage />)

    await userEvent.type(await screen.findByLabelText(/Téléphone/), '+237690000001')
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir un code' }))

    const code = await screen.findByLabelText(/Code/)
    await userEvent.type(code, '12 34-56')

    expect(code).toHaveValue('123456')
  })
  /**
   * **Le défaut qui bloquait tout le monde.** Une session ouverte n'a rien à
   * faire sur ce formulaire : on y saisissait son code et on y restait,
   * authentifié, sans que rien ne le dise. Il fallait taper l'URL de son espace,
   * qu'on ne connaissait pas.
   */
  it('emmène un compte agence dans son espace au lieu de le laisser là', async () => {
    mockRoutes({
      ...routes(),
      '/v1/me': () => jsonResponse({ id: 1, roles: ['AGENCY'] }),
    })

    /*
     * La session s'ouvre par son API, pas en écrivant dans `localStorage` :
     * `Session` mémorise son jeton, et le poser derrière son dos ne le lui
     * apprend pas. Sans jeton, `useCurrentUser` n'interroge rien — et c'est
     * juste, on ne peut pas être « déjà connecté » sans session.
     */
    await session.start('jeton-de-test')

    render(<SignInPage />)

    // Le formulaire disparaît : on n'est plus en train de se connecter.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Recevoir un code' }),
      ).not.toBeInTheDocument(),
    )

    await session.end()
  })

  /**
   * Le titre nomme les quatre espaces plutôt qu'un seul : l'annoncer comme celui
   * de l'administration fait croire aux trois autres qu'ils se connectent
   * ailleurs.
   */
  it('ne se présente pas comme réservé à l’administration', async () => {
    mockRoutes(routes())

    render(<SignInPage />)

    expect(
      await screen.findByRole('heading', { name: 'Espace professionnel' }),
    ).toBeInTheDocument()
  })
})
