import { type ReactNode, useEffect, useState } from 'react'
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { spacing, theme } from './theme'

export interface KeyboardFormProps {
  children: ReactNode
  /**
   * Ce qui reste accroché en bas — le bouton d'envoi, et ce qui l'accompagne.
   * Placé **dans** la zone qui remonte avec le clavier, sinon il resterait
   * dessous.
   */
  footer?: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
}

/**
 * La hauteur qu'occupe le clavier, telle que le système l'annonce.
 *
 * **Annoncée, et non déduite.** `KeyboardAvoidingView` ne lit pas cette hauteur :
 * il la calcule, en retranchant le haut du clavier de sa propre position mesurée.
 * Les deux valeurs viennent de repères différents — la position de la vue est
 * mesurée dans la fenêtre, celle du clavier dans l'écran — et sous l'affichage
 * bord à bord ces deux repères cessent de coïncider : ils diffèrent de la hauteur
 * de la barre de navigation. Le rembourrage obtenu était donc trop court d'autant,
 * ce qui laissait le dernier champ caché et le défilement à court de course.
 *
 * `endCoordinates.height` ne se déduit de rien : c'est ce que le clavier occupe.
 *
 * iOS émet les événements `Will`, ce qui permet de suivre l'animation d'ouverture
 * plutôt que de sauter à son terme ; Android n'émet que les `Did`.
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const opening = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const closing = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const shown = Keyboard.addListener(opening, (event) => {
      setHeight(event.endCoordinates.height)
    })
    const hidden = Keyboard.addListener(closing, () => setHeight(0))

    return () => {
      shown.remove()
      hidden.remove()
    }
  }, [])

  return height
}

/**
 * Un formulaire qui laisse voir ce qu'on saisit.
 *
 * **Ce qui n'allait pas.** Les cinq écrans de saisie portaient chacun leur copie
 * de `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` — et sur Android
 * `behavior` absent ne veut pas dire « comportement par défaut », ça veut dire
 * **aucun comportement** : `KeyboardAvoidingView` s'y réduit à une `View`. Tout
 * reposait donc sur `adjustResize`, le redimensionnement natif de la fenêtre, que
 * l'affichage bord à bord — activé d'office depuis le SDK 54 — neutralise.
 *
 * On retranche donc nous-mêmes la hauteur du clavier au cadre du formulaire. Le
 * `ScrollView` rétrécit d'autant, le pied de page remonte avec lui, et la course
 * de défilement couvre alors la totalité des champs.
 *
 * **Le défilement vers le champ actif vient en prime.** Le `ScrollView` d'Android
 * amène de lui-même l'élément qui prend le focus dans la partie visible — mais il
 * lui faut une partie visible à calculer. À hauteur pleine, il n'avait rien à
 * faire défiler : le champ était hors de l'écran sans que rien ne le sache.
 *
 * **Un seul exemplaire, et c'est le sujet.** Cinq copies d'un même réglage, c'est
 * cinq occasions de n'en corriger que quatre.
 */
export function KeyboardForm({
  children,
  footer,
  contentContainerStyle,
}: KeyboardFormProps) {
  const keyboard = useKeyboardHeight()

  return (
    // Le `testID` est là pour que la hauteur retirée soit mesurable : c'est la
    // seule chose que ce composant fait, et elle est invisible autrement.
    <View testID="keyboard-form" style={[styles.flex, { paddingBottom: keyboard }]}>
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        /*
         * Sans cela, le premier appui sur un bouton alors que le clavier est
         * ouvert ne fait que le refermer : il faut appuyer deux fois. `handled`
         * laisse le geste atteindre sa cible du premier coup.
         */
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {footer === undefined ? null : <View style={styles.footer}>{footer}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: theme.surface.card,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
})
