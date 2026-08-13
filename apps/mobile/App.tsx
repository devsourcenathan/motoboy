import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'
import type { BookingStatus } from '@motoboy/api-client/types'
import {
  bookingStatusLabels,
  colors,
  countdownTo,
  formatCountdown,
  formatMoney,
  spacing,
} from '@motoboy/shared'

/**
 * Écran de vérification de la chaîne.
 *
 * Il ne fait pas partie du produit : il prouve que les packages du workspace
 * traversent bien jusqu'à Metro. À remplacer par le vrai routage.
 */
export default function App() {
  const status: BookingStatus = 'PENDING_PAYMENT'
  const hold = countdownTo(new Date(Date.now() + 9 * 60_000).toISOString())

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MOTOBOY</Text>
      <Text>{bookingStatusLabels[status]}</Text>
      <Text style={styles.countdown}>{formatCountdown(hold)}</Text>
      <Text>{formatMoney({ amount: 6500, currency: 'XAF' })}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.brand[600],
  },
  countdown: {
    fontSize: 22,
    color: colors.status.held,
  },
})
