import { useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text } from 'react-native'
import { fontSize, Screen, spacing, theme } from '../../../shared/ui'

/**
 * Détail d'un départ — **provisoire**.
 *
 * Le plan de sièges, le choix des places et la réservation arrivent au chantier
 * suivant. Cet écran existe pour que la liste de résultats ne mène pas à une
 * route absente : un lien mort dans un parcours se découvre en production.
 */
export function TripScreen() {
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
