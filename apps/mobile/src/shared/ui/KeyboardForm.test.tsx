import { act, render, screen } from '@testing-library/react-native'
import { Keyboard, Text } from 'react-native'
import { KeyboardForm } from './KeyboardForm'

/**
 * Le formulaire face au clavier.
 *
 * ⚠️ `render` est **asynchrone** depuis Testing Library 14.
 *
 * **Ce que ces cas protègent.** Deux fois de suite, le clavier a recouvert les
 * champs du bas sur un vrai téléphone : d'abord parce qu'un `behavior` absent rend
 * `KeyboardAvoidingView` inerte sur Android, puis parce que la hauteur qu'il
 * déduisait était trop courte de la barre de navigation. Les deux échecs se
 * ressemblaient à l'écran, et aucun ne se voyait ailleurs que sur un téléphone.
 *
 * Ce qui se vérifie ici est donc la seule chose qui comptait dans les deux cas :
 * **la hauteur retirée au cadre est exactement celle que le système annonce**, ni
 * déduite, ni arrondie. Trop courte, et le défilement s'arrête avant le dernier
 * champ — le symptôme exact qui a été rapporté.
 */
/*
 * On intercepte les abonnements plutôt que d'émettre sur `Keyboard`.
 *
 * Deux raisons, et chacune suffirait. `Keyboard.emit` n'existe plus dans cette
 * version de React Native. Et le composant ne s'abonne pas toujours aux mêmes
 * événements : `Will` sur iOS pour suivre l'animation, `Did` sur Android qui
 * n'émet que ceux-là. Un test qui nomme l'événement en dur passerait sur une
 * plateforme et mentirait sur l'autre.
 */
const listeners = new Map<string, (event: unknown) => void>()

beforeEach(() => {
  listeners.clear()
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    event: string,
    handler: (payload: unknown) => void,
  ) => {
    listeners.set(event, handler)
    return { remove: () => listeners.delete(event) }
  }) as never)
})

afterEach(() => {
  jest.restoreAllMocks()
})

async function emit(moment: 'show' | 'hide', height: number) {
  const name = [...listeners.keys()].find((key) => key.toLowerCase().endsWith(moment))
  if (name === undefined) throw new Error(`Aucun abonnement pour « ${moment} ».`)

  await act(async () => {
    listeners.get(name)?.({
      endCoordinates: { height, screenX: 0, screenY: 0, width: 0 },
    })
  })
}

/** Le rembourrage effectivement appliqué au cadre, styles aplatis. */
function inset(): number | undefined {
  const style = screen.getByTestId('keyboard-form').props.style as unknown
  const entries = (Array.isArray(style) ? style.flat(Infinity) : [style]) as Array<{
    paddingBottom?: number
  } | null>

  return entries
    .filter(Boolean)
    .reduce<number | undefined>(
      (found, entry) =>
        entry?.paddingBottom === undefined ? found : entry.paddingBottom,
      undefined,
    )
}

describe('KeyboardForm', () => {
  it('ne retire rien tant que le clavier est fermé', async () => {
    await render(
      <KeyboardForm>
        <Text>champ</Text>
      </KeyboardForm>,
    )

    expect(inset()).toBe(0)
  })

  it('retire du cadre exactement la hauteur annoncée', async () => {
    await render(
      <KeyboardForm footer={<Text>valider</Text>}>
        <Text>champ</Text>
      </KeyboardForm>,
    )

    await emit('show', 312)

    expect(inset()).toBe(312)
    // Le pied de page reste rendu : c'est lui qui remonte avec le clavier, et
    // c'est son inaccessibilité qui obligeait à refermer le clavier pour valider.
    expect(screen.getByText('valider')).toBeTruthy()
  })

  /**
   * La hauteur change en cours de route — passage au clavier emoji, à la saisie
   * vocale. La suivre évite un trou figé sous le formulaire.
   */
  it('suit un clavier qui change de taille', async () => {
    await render(
      <KeyboardForm>
        <Text>champ</Text>
      </KeyboardForm>,
    )

    await emit('show', 312)
    await emit('show', 268)

    expect(inset()).toBe(268)
  })

  it('rend sa hauteur au cadre quand le clavier se referme', async () => {
    await render(
      <KeyboardForm>
        <Text>champ</Text>
      </KeyboardForm>,
    )

    await emit('show', 312)
    await emit('hide', 0)

    expect(inset()).toBe(0)
  })
})
