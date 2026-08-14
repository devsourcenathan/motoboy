import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Seat } from '@motoboy/api-client/types'
import { CrossIcon, fontSize, radius, spacing, theme } from '../../../shared/ui'
import { byRow, isSelectable } from '../model/seatSelection'

export interface SeatGridProps {
  seats: readonly Seat[]
  selected: readonly number[]
  onToggle: (seat: Seat) => void
}

/** Côté d'une place, en points. Assez grand pour être visé d'un pouce. */
const SEAT_SIZE = 44

export function SeatGrid({ seats, selected, onToggle }: SeatGridProps) {
  const { t } = useTranslation()

  return (
    <View style={styles.grid}>
      {byRow(seats).map((row, index) => (
        <View key={row[0]?.id ?? index} style={styles.row}>
          {row.map((seat) => {
            const chosen = selected.includes(seat.id)
            const free = isSelectable(seat)

            return (
              <Pressable
                key={seat.id}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen, disabled: !free }}
                // L'état est **dit**, pas seulement coloré : une place « prise »
                // et une place « libre » ne doivent pas se distinguer par la
                // seule couleur.
                accessibilityLabel={`${seat.label}, ${statusLabel(seat, chosen, t)}`}
                disabled={!free}
                onPress={() => onToggle(seat)}
                style={[styles.seat, seatStyle(seat, chosen)]}
              >
                {/*
                  Une place prise porte une croix, pas son numéro : le numéro
                  n'aide qu'à choisir, et celle-là ne se choisit plus. Le
                  lecteur d'écran, lui, continue d'annoncer « B3, prise ».
                */}
                {free || chosen ? (
                  <Text style={[styles.label, chosen ? styles.labelChosen : null]}>
                    {seat.label}
                  </Text>
                ) : (
                  <CrossIcon color={theme.text.muted} />
                )}
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

function statusLabel(seat: Seat, chosen: boolean, t: (key: string) => string): string {
  if (chosen) return t('trip.legend.selected')

  return {
    AVAILABLE: t('trip.legend.available'),
    HELD: t('trip.legend.held'),
    TAKEN: t('trip.legend.taken'),
    UNAVAILABLE: t('trip.legend.taken'),
  }[seat.status]
}

/**
 * `HELD` et `TAKEN` se distinguent visuellement, sans que ni l'une ni l'autre
 * soit choisissable : l'une peut se libérer, ce qui explique au passager
 * pourquoi le plan a changé quand il y revient (B2).
 */
function seatStyle(seat: Seat, chosen: boolean) {
  if (chosen) return styles.chosen

  return {
    AVAILABLE: styles.available,
    HELD: styles.held,
    TAKEN: styles.taken,
    UNAVAILABLE: styles.unavailable,
  }[seat.status]
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  seat: {
    width: SEAT_SIZE,
    height: SEAT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.primary,
  },
  labelChosen: {
    color: theme.text.inverse,
  },
  available: {
    backgroundColor: theme.surface.card,
    borderColor: theme.seat.available,
  },
  chosen: {
    backgroundColor: theme.seat.chosen,
    borderColor: theme.seat.chosen,
  },
  /**
   * Tenue par quelqu'un d'autre : contour or **tireté**, et non un aplat.
   * Elle peut se libérer, ce qui explique au passager pourquoi le plan a changé
   * quand il y revient (B2) — un aplat identique à « prise » ne le dirait pas.
   */
  held: {
    backgroundColor: theme.surface.card,
    borderColor: theme.seat.held,
    borderStyle: 'dashed',
  },
  taken: {
    backgroundColor: theme.seat.taken,
    borderColor: 'transparent',
  },
  unavailable: {
    backgroundColor: theme.seat.taken,
    borderColor: 'transparent',
  },
})
