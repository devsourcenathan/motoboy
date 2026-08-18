import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { fontSize, radius, spacing, theme } from '../../../shared/ui'

/**
 * Ce que veulent dire les couleurs.
 *
 * Sans légende, un plan de sièges se devine — et « réservée » se confond avec
 * « vendue » alors que l'une peut se libérer. Une couleur seule ne dit rien à
 * qui la distingue mal, d'où le texte à côté de chaque pastille.
 */
export function SeatLegend() {
  const { t } = useTranslation()

  const entries = [
    { key: 'available', style: styles.available },
    { key: 'selected', style: styles.chosen },
    { key: 'held', style: styles.held },
    { key: 'taken', style: styles.taken },
  ] as const

  return (
    <View style={styles.legend}>
      {entries.map((entry) => (
        <View key={entry.key} style={styles.entry}>
          <View style={[styles.swatch, entry.style]} />
          <Text style={styles.label}>{t(`trip.legend.${entry.key}`)}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  swatch: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  label: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  available: {
    backgroundColor: theme.seat.availableSoft,
    borderColor: theme.seat.available,
  },
  chosen: {
    backgroundColor: theme.seat.chosen,
    borderColor: theme.seat.chosen,
  },
  held: {
    backgroundColor: theme.surface.card,
    borderColor: theme.seat.held,
    borderStyle: 'dashed',
  },
  taken: {
    backgroundColor: theme.seat.taken,
    borderColor: theme.seat.taken,
  },
})
