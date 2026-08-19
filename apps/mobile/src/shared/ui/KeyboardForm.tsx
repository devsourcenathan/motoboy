import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
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
 * Un formulaire qui laisse voir ce qu'on saisit.
 *
 * **Ce qui n'allait pas.** Les cinq écrans de saisie portaient chacun leur copie
 * de `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` — et sur Android
 * `behavior` absent ne veut pas dire « comportement par défaut », ça veut dire
 * **aucun comportement** : `KeyboardAvoidingView` s'y réduit à une `View`. Tout
 * reposait donc sur `adjustResize`, le redimensionnement natif de la fenêtre.
 *
 * Or l'affichage bord à bord, activé d'office depuis le SDK 54, neutralise
 * précisément ce redimensionnement : la fenêtre ne rétrécit plus quand le
 * clavier s'ouvre. Résultat, sur Android le clavier se posait par-dessus les
 * champs et par-dessus le bouton, et il fallait le refermer pour valider.
 *
 * `padding` sur les deux plateformes remplace ce que le système ne fait plus.
 * Rien ne change sur iOS, qui l'utilisait déjà.
 *
 * **Le défilement vers le champ actif vient en prime.** Le `ScrollView` d'Android
 * amène de lui-même l'élément qui prend le focus dans la partie visible — mais
 * seulement s'il y a une partie visible à calculer. Tant qu'il gardait sa hauteur
 * pleine, il n'avait rien à faire défiler : le champ était hors de l'écran sans
 * que rien ne le sache.
 *
 * **Un seul exemplaire, et c'est le sujet.** Cinq copies d'un même réglage, c'est
 * cinq occasions de n'en corriger que quatre.
 */
export function KeyboardForm({
  children,
  footer,
  contentContainerStyle,
}: KeyboardFormProps) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
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
    </KeyboardAvoidingView>
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
