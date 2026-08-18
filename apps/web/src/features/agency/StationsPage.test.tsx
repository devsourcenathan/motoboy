import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { AgencyStation } from '@motoboy/api-client/types'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { StationsPage } from './StationsPage'

/**
 * Les gares.
 *
 * **Le premier maillon de l'inventaire** : sans gare, pas d'itinéraire, donc pas
 * de départ, donc rien à chercher. Ce que cet écran doit garantir, c'est qu'une
 * gare se rattache toujours à une ville **du référentiel** — une saisie libre
 * créerait autant de « Douala » que d'orthographes, et la recherche cesserait de
 * regrouper les offres de plusieurs agences.
 */
const PENDING: AgencyStation = {
  id: 1,
  name: 'Gare de Bonabéri',
  city: 'Douala',
  city_id: 5,
  address: 'Carrefour Bonabéri',
  is_active: true,
  moderated_at: null,
}

const list = (...rows: AgencyStation[]) => jsonResponse({ data: rows })

const cities = () =>
  jsonResponse({
    data: [
      { type: 'CITY', city_id: 5, station_id: null, label: 'Douala', secondary_label: null },
    ],
  })

describe('StationsPage', () => {
  it('propose de créer une gare quand il n’y en a aucune', async () => {
    mockRoutes({ '/agency/stations': () => list() })

    render(<StationsPage />)

    expect(await screen.findByText('Aucune gare')).toBeInTheDocument()
  })

  /**
   * Trois états, pas deux : « en vérification » n'est ni actif ni inactif, et les
   * confondre ferait croire à une erreur de saisie là où il n'y a qu'une attente
   * normale.
   */
  it('distingue une gare en vérification d’une gare active', async () => {
    mockRoutes({
      '/agency/stations': () =>
        list(PENDING, { ...PENDING, id: 2, moderated_at: '2026-08-01T00:00:00Z' }),
    })

    render(<StationsPage />)

    expect(await screen.findByText('En vérification')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  /**
   * **Le cœur de l'écran.** Tant qu'aucune ville du référentiel n'est
   * sélectionnée, on ne peut pas créer : sans cela une agence saisirait un nom
   * de ville au clavier et sa gare ne se rattacherait à rien.
   */
  it('refuse de créer tant qu’aucune ville du référentiel n’est choisie', async () => {
    mockRoutes({ '/agency/stations': () => list(), '/places/autocomplete': cities })

    render(<StationsPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter une gare' }))
    await userEvent.type(screen.getByPlaceholderText('Gare de Bonabéri'), 'Gare du Nord')

    expect(screen.getByRole('button', { name: 'Créer la gare' })).toBeDisabled()
  })

  it('crée la gare avec l’identifiant de la ville choisie', async () => {
    mockRoutes({
      '/agency/stations': () => list(),
      '/places/autocomplete': cities,
    })

    render(<StationsPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter une gare' }))
    await userEvent.type(screen.getByPlaceholderText('Gare de Bonabéri'), 'Gare du Nord')
    await userEvent.type(screen.getByPlaceholderText('Douala'), 'dou')

    await userEvent.click(await screen.findByRole('button', { name: 'Douala' }))
    await userEvent.click(screen.getByRole('button', { name: 'Créer la gare' }))

    /*
     * On vérifie le **corps du POST**, pas seulement l'URL : le GET de la liste
     * touche le même chemin, et une assertion sur l'URL seule passerait sans
     * qu'aucune gare n'ait été créée.
     */
    await waitFor(async () => {
      const mock = fetch as unknown as { mock: { calls: [Request | string][] } }

      const post = mock.mock.calls
        .map(([input]) => input)
        .find((input) => typeof input !== 'string' && input.method === 'POST')

      expect(post).toBeDefined()

      // Cloné : le corps est un flux, et le lire ici le consommerait.
      const body = await (post as Request).clone().text()

      expect(JSON.parse(body)).toMatchObject({ city_id: 5, name: 'Gare du Nord' })
    })
  })
})
