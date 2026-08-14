import { useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text } from 'react-native'
import { fontSize, Screen, spacing, theme } from '../../../shared/ui'

/**
 * Paiement — **provisoire**.
 *
 * Le Mobile Money est asynchrone par nature : le passager reçoit une
 * sollicitation sur son téléphone et saisit son code, et c'est le webhook qui
 * tranche. Cet écran arrive au chantier suivant ; il existe déjà pour que la
 * réservation ne mène pas à une route absente.
 */
export function PaymentScreen() {
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
