import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Logo } from './ui'

/**
 * La marque.
 *
 * Deux erreurs seulement méritent d'être verrouillées ici, mais elles sont
 * toutes deux invisibles à la relecture et visibles à l'écran.
 */
describe('Logo', () => {
  /**
   * **Le carré marine sur un en-tête marine.** Tous les bandeaux du back-office
   * sont en `bg-ink-700`. La variante `icon` y dessinerait un carré marine sur du
   * marine, révélé par son seul arrondi — on ne lit pas cela comme une marque, on
   * le lit comme un export raté.
   */
  it('n’emporte le carré marine que dans la variante icon', () => {
    const { container: withSquare } = render(<Logo variant="icon" />)
    const { container: bare } = render(<Logo variant="mark" />)

    expect(withSquare.querySelector('rect')).not.toBeNull()
    expect(bare.querySelector('rect')).toBeNull()
    // Le dessin, lui, est présent dans les deux.
    expect(bare.querySelectorAll('path')).toHaveLength(2)
  })

  /**
   * **« MOTOBOY MOTOBOY ».** La marque est presque toujours posée à côté du mot
   * écrit ; l'exposer aux lecteurs d'écran ferait annoncer le nom deux fois. Elle
   * ne se nomme que lorsqu'elle est seule, et c'est alors le `title` qui le dit.
   */
  it('reste muette sauf si on la nomme', () => {
    const { container: mute } = render(<Logo />)
    expect(mute.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')

    const { getByRole } = render(<Logo title="MOTOBOY" />)
    expect(getByRole('img', { name: 'MOTOBOY' })).toBeInTheDocument()
  })
})
