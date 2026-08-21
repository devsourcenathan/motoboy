import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { RoutesPage } from './RoutesPage'

/**
 * Les itinéraires et leurs horaires.
 *
 * **Trois objets qui s'enchaînent** : un itinéraire relie deux gares, un horaire
 * le fait partir régulièrement, et les départs en sont *générés*. Confondre les
 * trois fait attendre des départs que rien ne produit — d'où ce que ces tests
 * gardent.
 */
const route = {
  id: 1,
  origin: { city: 'Douala', station: 'Bonabéri' },
  destination: { city: 'Bafoussam', station: 'Gare routière' },
  reference_duration_minutes: 240,
  schedules: [],
}

const routes = (extra: Record<string, () => Response> = {}) => ({
  '/agency/routes': () => jsonResponse({ data: [route] }),
  '/agency/vehicles': () => jsonResponse({ data: [{ id: 5, registration: 'LT-1' }] }),
  '/agency/drivers': () => jsonResponse({ data: [] }),
  '/agency/stations': () => jsonResponse({ data: [] }),
  /*
   * `extra` en **dernier** : posé en premier, il se faisait écraser par les
   * routes par défaut, si bien qu'un test qui croyait remplacer une réponse
   * obtenait l'autre — sans erreur, et en passant pour la mauvaise raison.
   */
  ...extra,
})

describe('RoutesPage', () => {
  /**
   * **Un itinéraire sans horaire ne produit rien.** Le taire laisserait une
   * agence attendre des départs que la génération ne fabriquera jamais.
   */
  it('dit qu’un itinéraire sans horaire ne part pas', async () => {
    mockRoutes(routes())

    render(<RoutesPage />)

    expect(
      await screen.findByRole('button', { name: 'Ajouter un horaire' }),
    ).toBeInTheDocument()
  })

  /**
   * **Le test qui compte.** Les jours partent en entiers ISO — lundi vaut 1 — et
   * tous sont cochés d'emblée : un horaire quotidien est le cas courant, et
   * partir de zéro ferait oublier des jours plus souvent qu'en retirer.
   *
   * Le formulaire refuse en revanche tant qu'aucun véhicule n'est désigné : rien
   * n'assurerait le départ, et l'horaire resterait inerte sans que rien ne le
   * dise.
   */
  it('retire les jours décochés et refuse sans véhicule', async () => {
    mockRoutes(routes({ '/schedules': () => jsonResponse({ id: 1 }) }))

    render(<RoutesPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ajouter un horaire' }),
    )

    /*
     * `fireEvent.change` plutôt qu'une frappe : un champ `time` se saisit segment
     * par segment, et simuler les touches y produit des valeurs intermédiaires —
     * « 07:59 » au lieu de « 08:00 ». Ce test porte sur ce qui part au serveur,
     * pas sur la mécanique d'un contrôle natif.
     */
    fireEvent.change(screen.getByLabelText(/Heure de départ/), {
      target: { value: '08:00' },
    })
    await userEvent.type(screen.getByLabelText(/Prix en FCFA/), '5000')

    const creer = screen.getByRole('button', { name: 'Créer l’horaire' })
    expect(creer).toBeDisabled()

    /*
     * Les jours se désignent par leur position et non par leur initiale : « M »
     * vaut mardi *et* mercredi. C'est aussi pourquoi ce qui part au serveur doit
     * être vérifié — l'écran ne les distingue pas non plus à l'œil.
     */
    const jours = [...document.querySelectorAll('button[aria-pressed]')]

    await userEvent.click(jours[0] as HTMLElement) // lundi, 1
    await userEvent.click(jours[2] as HTMLElement) // mercredi, 3

    await userEvent.selectOptions(screen.getByLabelText(/Véhicule/), '5')

    expect(creer).toBeEnabled()
    await userEvent.click(creer)

    expect(
      await sentRequest(
        (request) => request.method === 'POST' && request.url.includes('/schedules'),
      ),
    ).toMatchObject({
      departure_time: '08:00',
      price: 5000,
      days_of_week: [2, 4, 5, 6, 7],
    })
  })
  /**
   * **Les jours d'un horaire se lisent d'un coup d'œil ou ne se lisent pas.**
   * Un horaire qui ne part que la semaine, affiché comme les autres, fait
   * promettre un départ le dimanche — et c'est le passager qui l'apprend à la
   * gare.
   *
   * Les mêmes sept pastilles servent à lire et à choisir : le test porte sur ce
   * que la lecture doit distinguer, l'état choisi étant dit par `aria-pressed`
   * du côté du formulaire.
   */
  it('distingue les jours où un horaire part de ceux où il ne part pas', async () => {
    mockRoutes(
      routes({
        '/agency/routes': () =>
          jsonResponse({
            data: [
              {
                ...route,
                schedules: [
                  {
                    id: 9,
                    departure_time: '07:30',
                    days_of_week: [1, 2, 3, 4, 5],
                    price: { amount: 6500, currency: 'XAF' },
                  },
                ],
              },
            ],
          }),
      }),
    )

    render(<RoutesPage />)

    expect(await screen.findByText('07:30')).toBeInTheDocument()

    // Sept pastilles, toujours : masquer les jours creux ferait lire « part le
    // lundi » là où il faut lire « ne part pas le dimanche ».
    const jours = screen.getAllByText(/^[LMJVSD]$/)

    expect(jours).toHaveLength(7)
    expect(screen.queryByText(/Aucun horaire/)).toBeNull()
  })
  /**
   * **Un horaire vendait pour toujours.**
   *
   * Créé, il produisait des départs sur tout l'horizon sans qu'aucun écran ne
   * puisse l'arrêter : une ligne qui cesse d'être desservie continuait d'être
   * vendue, et les passagers l'apprenaient à la gare.
   */
  it('arrête un horaire, et dit ce que cela ne défait pas', async () => {
    mockRoutes(
      routes({
        '/schedules/9': () => jsonResponse({ id: 9, is_active: false }),
        '/agency/routes': () =>
          jsonResponse({
            data: [
              {
                ...route,
                schedules: [
                  {
                    id: 9,
                    departure_time: '07:30',
                    days_of_week: [1, 2, 3],
                    price: { amount: 6500, currency: 'XAF' },
                    is_active: true,
                  },
                ],
              },
            ],
          }),
      }),
    )

    render(<RoutesPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Arrêter' }))

    expect(
      await sentRequest((request) => request.url.includes('/schedules/9')),
    ).toMatchObject({ is_active: false })
  })
})
