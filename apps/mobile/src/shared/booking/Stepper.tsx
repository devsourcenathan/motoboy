import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { CheckIcon, fontSize, radius, sharedStyles, spacing, theme } from '../ui'

/** Les trois étapes, dans l'ordre où on les franchit. */
export const BOOKING_STEPS = ['seats', 'details', 'payment'] as const

export type BookingStep = (typeof BOOKING_STEPS)[number]

/**
 * Où en est la réservation.
 *
 * **Trois étapes annoncées d'emblée.** Le passager engage une tenue de place :
 * savoir combien il reste à faire est ce qui l'empêche d'abandonner en croyant
 * le tunnel plus long qu'il n'est. Une étape franchie porte une coche et non son
 * numéro — le numéro sert à se situer, la coche à se rassurer.
 */
export function Stepper({ current }: { current: BookingStep }) {
  const { t } = useTranslation()
  const index = BOOKING_STEPS.indexOf(current)

  return (
    <View
      style={styles.card}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: BOOKING_STEPS.length, now: index + 1 }}
    >
      {BOOKING_STEPS.map((step, position) => {
        const done = position < index
        const active = position === index

        return (
          <View key={step} style={styles.slot}>
            {position === 0 ? null : (
              <View style={[styles.rail, position <= index ? styles.railDone : null]} />
            )}

            <View style={styles.stop}>
              <View
                style={[
                  styles.bubble,
                  done || active ? styles.bubbleOn : null,
                  active ? styles.bubbleActive : null,
                ]}
              >
                {done ? (
                  <CheckIcon color={theme.text.inverse} size={16} />
                ) : (
                  <Text style={[styles.number, active ? styles.numberOn : null]}>
                    {position + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.label, active ? styles.labelActive : null]}>
                {t(`steps.${step}`)}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const BUBBLE = 32

const styles = StyleSheet.create({
  card: {
    ...sharedStyles.card,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
  },
  stop: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  /*
   * Le trait relie deux pastilles : il part du bord gauche de la case et
   * s'arrête au centre, là où la pastille commence.
   */
  rail: {
    position: 'absolute',
    right: '50%',
    left: -BUBBLE,
    top: BUBBLE / 2 - 1,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: theme.surface.inert,
  },
  railDone: {
    backgroundColor: theme.surface.brand,
  },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.inert,
  },
  bubbleOn: {
    backgroundColor: theme.surface.brand,
  },
  /** L'étape courante porte un halo : elle se repère sans compter. */
  bubbleActive: {
    borderWidth: 4,
    borderColor: theme.surface.brandSoft,
  },
  number: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.secondary,
  },
  numberOn: {
    color: theme.text.inverse,
  },
  label: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
  labelActive: {
    fontWeight: '700',
    color: theme.text.brand,
  },
})
