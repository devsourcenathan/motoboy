import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { BookingCancellation, BookingPassenger } from '@motoboy/api-client/types'
import { formatDateTime, formatMoney } from '@motoboy/shared'
import {
  Button,
  fontSize,
  radius,
  Screen,
  spacing,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import {
  useBooking,
  useCancelBooking,
  useCancellationQuote,
} from '../api/useCancellation'

/**
 * Annulation, totale ou partielle.
 *
 * **Le devis passe avant la confirmation.** Le passager doit voir ce qu'il
 * récupérera avant de valider : sans cela, il découvre les frais retenus après
 * coup, et une règle qu'il avait acceptée devient un litige (B5).
 *
 * L'annulation partielle est supportée dès le MVP — trois places réservées, une
 * annulée — et le devis se recalcule à chaque changement de sélection.
 */
export function CancelBookingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const describe = useErrorMessage()

  const reference = useLocalSearchParams<{ reference: string }>().reference ?? ''

  const booking = useBooking(reference)
  const [selected, setSelected] = useState<readonly number[]>([])
  const quote = useCancellationQuote(reference, selected)
  const cancel = useCancelBooking(reference)

  if (booking.isPending) {
    return (
      <Screen title={t('cancellation.title')}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      </Screen>
    )
  }

  if (booking.data === undefined) {
    return (
      <Screen title={t('cancellation.title')}>
        <View style={styles.centered}>
          <Text style={styles.message}>{describe(booking.error)}</Text>
        </View>
      </Screen>
    )
  }

  if (cancel.data !== undefined) {
    return <Done result={cancel.data} onClose={() => router.dismissAll()} />
  }

  const active = booking.data.passengers.filter(
    (passenger) => passenger.status === 'ACTIVE',
  )
  const everyone = selected.length === 0

  function toggle(passenger: BookingPassenger) {
    setSelected((current) =>
      current.includes(passenger.id)
        ? current.filter((id) => id !== passenger.id)
        : [...current, passenger.id],
    )
  }

  return (
    <Screen title={t('cancellation.title')}>
      <ScrollView contentContainerStyle={styles.content}>
        {/*
          Plusieurs passagers : le choix a un sens. Un seul : le proposer
          reviendrait à demander une décision qui n'existe pas.
        */}
        {active.length > 1 ? (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('cancellation.whoLeaves')}</Text>

            <Choice
              label={t('cancellation.all')}
              selected={everyone}
              onPress={() => setSelected([])}
            />

            {active.map((passenger) => (
              <Choice
                key={passenger.id}
                label={`${passenger.first_name} ${passenger.last_name}${
                  passenger.seat_label === null || passenger.seat_label === undefined
                    ? ''
                    : ` · ${passenger.seat_label}`
                }`}
                selected={selected.includes(passenger.id)}
                onPress={() => toggle(passenger)}
              />
            ))}
          </View>
        ) : null}

        <Quote quote={quote} />

        {cancel.error ? <Text style={styles.error}>{describe(cancel.error)}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={t('cancellation.confirm')}
          onPress={() => cancel.mutate(selected)}
          // Rien ne se confirme tant que le devis n'a pas répondu : valider sur
          // un montant inconnu est exactement ce que cet écran existe pour
          // éviter.
          disabled={quote.data?.cancellable !== true}
          busy={cancel.isPending}
        />
      </View>
    </Screen>
  )
}

/**
 * Le devis, tel qu'il se lit.
 *
 * Il reçoit le résultat de la requête plutôt que de la relancer : deux appels
 * sur la même clé se dédupliquent, mais le second n'apporte rien et ferait
 * croire à deux sources.
 */
function Quote({ quote }: { quote: ReturnType<typeof useCancellationQuote> }) {
  const { t } = useTranslation()
  const locale = useLocale()

  if (quote.isPending) {
    return <ActivityIndicator color={theme.text.brand} />
  }

  if (quote.data === undefined) return null

  if (!quote.data.cancellable) {
    return (
      <View style={styles.refused} accessibilityRole="alert">
        <Text style={styles.refusedText}>
          {quote.data.reason_if_not === 'CANCELLATION_DEADLINE_PASSED'
            ? t('cancellation.refused.deadlinePassed')
            : t('cancellation.refused.notCancellable')}
        </Text>
      </View>
    )
  }

  const free = quote.data.fee.amount === 0

  return (
    <View style={styles.quote}>
      <Text style={styles.quoteLabel}>{t('cancellation.refundable')}</Text>
      <Text style={styles.quoteAmount}>{formatMoney(quote.data.refundable, locale)}</Text>

      <Text style={styles.quoteLine}>
        {t('cancellation.fee')} ·{' '}
        {free ? t('cancellation.free') : formatMoney(quote.data.fee, locale)}
      </Text>

      {quote.data.deadline_at === undefined ? null : (
        <Text style={styles.quoteLine}>
          {t('cancellation.deadline', {
            date: formatDateTime(quote.data.deadline_at, { locale }),
          })}
        </Text>
      )}

      <Text style={styles.note}>{t('cancellation.toSource')}</Text>
    </View>
  )
}

function Done({ result, onClose }: { result: BookingCancellation; onClose: () => void }) {
  const { t } = useTranslation()
  const locale = useLocale()

  return (
    <Screen title={t('cancellation.done.title')}>
      <View style={styles.centered}>
        <Text style={styles.message}>
          {/*
            `refund` nul veut dire qu'aucun argent ne transite par la
            plateforme : vente au comptoir encaissée en espèces, ou frais égaux
            au montant payé. Le dire évite d'attendre un virement qui ne
            viendra pas.
          */}
          {result.refunded.amount > 0
            ? t('cancellation.done.refunded', {
                amount: formatMoney(result.refunded, locale),
              })
            : t('cancellation.done.noRefund')}
        </Text>

        {result.refund === null || result.refunded.amount === 0 ? null : (
          <Text style={styles.note}>{t('cancellation.done.pending')}</Text>
        )}

        <Button label={t('cancellation.done.close')} onPress={onClose} />
      </View>
    </Screen>
  )
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.choice, selected ? styles.choiceSelected : null]}
    >
      <Text style={selected ? styles.choiceLabelSelected : styles.choiceLabel}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
    textTransform: 'uppercase',
  },
  choice: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.surface.border,
    backgroundColor: theme.surface.raised,
  },
  choiceSelected: {
    borderColor: theme.surface.brand,
    backgroundColor: theme.surface.brandSoft,
  },
  choiceLabel: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
  },
  choiceLabelSelected: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.brand,
  },
  quote: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: theme.surface.raised,
  },
  quoteLabel: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
    textTransform: 'uppercase',
  },
  quoteAmount: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: theme.text.primary,
  },
  quoteLine: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
  },
  note: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  refused: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: theme.surface.raised,
  },
  refusedText: {
    fontSize: fontSize.base,
    color: theme.text.danger,
  },
  message: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  error: {
    fontSize: fontSize.base,
    color: theme.text.danger,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
})
