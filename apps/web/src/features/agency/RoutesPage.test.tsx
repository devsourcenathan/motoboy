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
  ...extra,
  '/agency/routes': () => jsonResponse({ data: [route] }),
  '/agency/vehicles': () => jsonResponse({ data: [{ id: 5, registration: 'LT-1' }] }),
  '/agency/drivers': () => jsonResponse({ data: [] }),
  '/agency/stations': () => jsonResponse({ data: [] }),
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
})
