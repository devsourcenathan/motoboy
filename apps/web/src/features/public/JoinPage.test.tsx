import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { i18next } from '../../lib/i18n'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { JoinPage } from './JoinPage'

/**
 * L'inscription d'une agence.
 *
 * **La porte d'entrée du côté offre.** L'API l'acceptait déjà et aucun écran ne
 * l'appelait : une agence n'avait nulle part où dire qu'elle voulait rejoindre la
 * plateforme, et le seul chemin passait par une commande `curl`.
 */
const routes = (extra: Record<string, () => Response> = {}) => ({
  ...extra,
  '/agencies/register': () =>
    jsonResponse({ expires_at: '2026-08-20T09:00:00Z', attempts_remaining: 3 }, 201),
})

const remplir = async () => {
  await userEvent.type(await screen.findByLabelText(/Nom commercial/), 'Général Express')
  await userEvent.type(screen.getByLabelText(/Téléphone de l’agence/), '+237690000010')
  await userEvent.type(screen.getByLabelText(/^Prénom/), 'Awa')
  await userEvent.type(screen.getByLabelText(/^Nom$/), 'Nkeng')
  await userEvent.type(screen.getByLabelText(/Son téléphone/), '+237690000011')
}

describe('JoinPage', () => {
  /**
   * **Le numéro du responsable devient un compte**, et l'écran doit le dire avant
   * qu'on le saisisse. Découvert après coup, on y met celui de l'accueil — et
   * plus personne ne peut entrer.
   */
  it('prévient que le numéro du responsable devient le compte', async () => {
    mockRoutes(routes())

    render(<JoinPage />)

    expect(
      await screen.findByText(/devient le compte qui gérera l’agence/),
    ).toBeInTheDocument()
  })

  it('n’envoie rien tant que l’essentiel manque', async () => {
    mockRoutes(routes())

    render(<JoinPage />)

    expect(
      await screen.findByRole('button', { name: 'Envoyer la candidature' }),
    ).toBeDisabled()
  })

  /**
   * **Les facultatifs ne partent pas vides.** Une chaîne vide n'est pas « non
   * renseigné » : la validation d'un email refuserait `''` et l'agence lirait un
   * refus sur un champ qu'elle avait le droit de laisser libre.
   */
  it('omet les champs facultatifs plutôt que de les envoyer vides', async () => {
    mockRoutes(routes())

    render(<JoinPage />)
    await remplir()
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la candidature' }))

    const sent = (await sentRequest((request) =>
      request.url.includes('/agencies/register'),
    )) as Record<string, unknown>

    expect(sent).toMatchObject({
      name: 'Général Express',
      manager_phone: '+237690000011',
    })
    expect(sent).not.toHaveProperty('email')
    expect(sent).not.toHaveProperty('legal_name')
  })

  /**
   * **La langue de l'écran décide de celle du SMS** — le tout premier message
   * reçu, avant même que le compte existe. Une agence de Bamenda qui remplit ce
   * formulaire en anglais ne doit pas recevoir son code en français.
   */
  it('transmet la langue de l’écran, qui sera celle du SMS', async () => {
    mockRoutes(routes())

    await i18next.changeLanguage('en')

    render(<JoinPage />)

    await userEvent.type(await screen.findByLabelText(/Trading name/), 'Général Express')
    await userEvent.type(screen.getByLabelText(/Agency phone/), '+237690000010')
    await userEvent.type(screen.getByLabelText(/^First name/), 'Awa')
    await userEvent.type(screen.getByLabelText(/^Last name/), 'Nkeng')
    await userEvent.type(screen.getByLabelText(/Their phone/), '+237690000011')
    await userEvent.click(screen.getByRole('button', { name: 'Send the application' }))

    expect(
      await sentRequest((request) => request.url.includes('/agencies/register')),
    ).toMatchObject({ locale: 'en' })
  })

  /**
   * Le code est vérifié avec le motif `REGISTRATION`. Envoyer `LOGIN` ferait
   * refuser un code parfaitement bon, avec un message parlant d'un code invalide.
   */
  it('vérifie le code comme une inscription, pas comme une connexion', async () => {
    mockRoutes(
      routes({
        '/otp/verify': () => jsonResponse({ token: 'jeton', user: { id: 1, roles: [] } }),
      }),
    )

    render(<JoinPage />)
    await remplir()
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la candidature' }))

    await userEvent.type(await screen.findByLabelText(/Code reçu/), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(
      await sentRequest((request) => request.url.includes('/otp/verify')),
    ).toMatchObject({
      purpose: 'REGISTRATION',
      phone: '+237690000011',
    })
  })
})
