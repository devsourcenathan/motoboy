import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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
})
