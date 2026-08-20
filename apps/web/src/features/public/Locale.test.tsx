import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { SearchPage } from './SearchPage'

/**
 * Le comparateur en deux langues.
 *
 * Le brief le dit sans détour : le Cameroun a deux langues officielles, et
 * Douala–Bamenda est un axe fréquenté. Un comparateur uniquement francophone
 * n'ampute pas « les autres pays plus tard » — il ampute une part du marché de
 * lancement, par défaut.
 */
const routes = () => ({
  '/places/autocomplete': () => jsonResponse({ data: [] }),
  '/trips': () => jsonResponse({ data: [] }),
})

describe('Langue du comparateur', () => {
  /**
   * **Le test qui compte.** Sans lui, une clé oubliée dans le catalogue anglais
   * s'afficherait telle quelle — « public:search.submit » — et rien ne le
   * signalerait, puisque la page continuerait de rendre.
   */
  it('bascule la page entière en anglais', async () => {
    mockRoutes(routes())

    render(<SearchPage />)

    expect(await screen.findByRole('button', { name: 'Chercher' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'English' }))

    expect(await screen.findByRole('button', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByText(/Compare departures from every agency/)).toBeInTheDocument()
    // Et le français a bien disparu, pas seulement l'anglais apparu.
    expect(screen.queryByRole('button', { name: 'Chercher' })).not.toBeInTheDocument()
  })

  /**
   * `lang` sur la racine du document n'est pas décoratif : c'est ce qui fait lire
   * la page avec le bon accent par un lecteur d'écran, et ce sur quoi le
   * navigateur s'appuie pour la césure et la correction orthographique.
   */
  it('déclare la langue au document', async () => {
    mockRoutes(routes())

    render(<SearchPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'English' }))

    expect(document.documentElement.lang).toBe('en')
  })

  /**
   * Le choix doit survivre au rechargement — c'est ce qui distingue le web du
   * mobile, dont l'application garde son état. Quelqu'un qui bascule en anglais
   * puis appuie sur F5 ne doit pas retrouver du français.
   */
  it('retient le choix pour le prochain chargement', async () => {
    mockRoutes(routes())

    render(<SearchPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'English' }))

    expect(localStorage.getItem('motoboy.locale')).toBe('en')
  })
})
