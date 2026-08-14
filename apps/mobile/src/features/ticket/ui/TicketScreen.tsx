import { useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text } from 'react-native'
import { fontSize, Screen, spacing, theme } from '../../../shared/ui'

/**
 * Billet — **provisoire**.
 *
 * Le billet doit rester consultable **sans réseau**, et le QR se regénérer à
 * partir des données stockées plutôt que se télécharger comme image : un billet
 * dont le code ne s'affiche pas en gare ne vaut rien (I5). Cet écran arrive au
 * chantier suivant ; il existe pour que le paiement ne mène pas à une route
 * absente.
 */
export function TicketScreen() {
  const { reference } = useLocalSearchParams<{ reference: string }>()

  return (
    <Screen title={reference}>
      <Text style={styles.body}>…</Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    fontSize: fontSize.base,
    color: theme.text.muted,
  },
})
