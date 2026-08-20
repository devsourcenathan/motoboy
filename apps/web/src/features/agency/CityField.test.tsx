import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { CityField, type CityChoice } from './CityField'

/**
 * Le choix d'une ville.
 *
 * **Une agence ne saisit pas un nom, elle en désigne un du référentiel.** C'est
 * ce qui empêche deux Douala — et donc une recherche qui ne trouve pas le départ
 * qui existe.
 */
const cities = () => ({
  '/places/autocomplete': () =>
    jsonResponse({
      data: [
        { type: 'CITY', city_id: 3, label: 'Bafoussam', secondary_label: null },
        { type: 'CITY', city_id: 1, label: 'Douala', secondary_label: null },
      ],
    }),
})

describe('CityField', () => {
  /**
   * **Le test qui compte.** Choisir une suggestion rend l'identifiant du
   * référentiel, jamais le texte tapé. Rendre la chaîne laisserait créer une
   * ville par faute de frappe.
   */
  it('rend l’identifiant du référentiel, pas le texte saisi', async () => {
    const onChange = vi.fn()
    mockRoutes(cities())

    render(<CityField label="Ville" value={null} onChange={onChange} />)

    await userEvent.type(screen.getByLabelText(/Ville/), 'Baf')
    await userEvent.click(await screen.findByText('Bafoussam'))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3, label: 'Bafoussam' }) as CityChoice,
    )
  })

  /**
   * Retaper après avoir choisi **efface le choix**. Le garder ferait envoyer
   * l'ancienne ville pendant que l'écran en affiche une autre — l'écart le plus
   * silencieux qui soit.
   */
  it('oublie le choix dès qu’on retouche la saisie', async () => {
    const onChange = vi.fn()
    mockRoutes(cities())

    render(
      <CityField label="Ville" value={{ id: 1, label: 'Douala' }} onChange={onChange} />,
    )

    await userEvent.type(screen.getByLabelText(/Ville/), 'x')

    expect(onChange).toHaveBeenCalledWith(null)
  })
})
