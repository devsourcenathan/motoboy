import { render, screen } from '@testing-library/react-native'
import { View } from 'react-native'
import { SkeletonList } from './Skeleton'

/**
 * ⚠️ `render` est **asynchrone** depuis Testing Library 14.
 */
describe('SkeletonList', () => {
  /**
   * **Le squelette doit rester large sous un parent qui centre.**
   *
   * Plusieurs états vides centrent leurs enfants. Sans `alignSelf: 'stretch'`,
   * la liste se réduisait à son contenu, et des barres en `width: '100%'` d'un
   * parent large de zéro devenaient invisibles : l'écran paraissait vide au lieu
   * de paraître en train de charger — exactement le symptôme qu'un squelette
   * existe pour éviter.
   */
  it('reste large même dans un conteneur qui centre ses enfants', async () => {
    await render(
      <View style={{ alignItems: 'center' }} testID="parent">
        <SkeletonList count={3} />
      </View>,
    )

    const list = screen.getByTestId('parent').children[0]

    // `children` rend des éléments React ; on lit le style déclaré du conteneur.
    const style = (list as { props: { style: { alignSelf?: string }[] } }).props.style

    expect(JSON.stringify(style)).toContain('stretch')
  })
})
