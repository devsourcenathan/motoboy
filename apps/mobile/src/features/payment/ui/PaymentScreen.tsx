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
import { useQuery } from '@tanstack/react-query'
import { unwrap, type Booking } from '@motoboy/api-client'
import { formatMoney } from '@motoboy/shared'
import {
  Button,
  fontSize,
  radius,
  Screen,
  spacing,
  TextField,
  theme,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { HoldBanner, useHoldCountdown } from '../../../shared/booking'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'
import { useInitiatePayment, usePaymentStatus } from '../api/usePayment'
import {
  OPERATORS,
  phaseOf,
  validate,
  type Operator,
  type PaymentForm,
} from '../model/payment'

/**
 * Paiement Mobile Money.
 *
 * **Asynchrone par nature.** Le passager reçoit une sollicitation sur son
 * téléphone et doit y saisir son code : rien n'est encaissé de façon synchrone,
 * et c'est le webhook qui tranche. L'écran ne doit donc **ni promettre un
 * succès, ni abandonner au premier délai** — il attend, en le disant.
 *
 * **L'échec est banal, et réessayer est le cas nominal** : un code mal composé,
 * un solde insuffisant, un réseau opérateur saturé. Les places ne sont pas
 * libérées pour autant — la fenêtre de tenue court en entier (B2).
 */
export function PaymentScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const locale = useLocale()
  const describe = useErrorMessage()

  const bookingReference = useLocalSearchParams<{ reference: string }>().reference ?? ''

  const booking = useQuery({
    queryKey: queryKeys.booking(bookingReference),
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/bookings/{reference}', {
        params: { path: { reference: bookingReference } },
        signal,
      })

      return unwrap(response) as Booking
    },
  })

  const initiate = useInitiatePayment(bookingReference)
  const status = usePaymentStatus(initiate.reference)
  const countdown = useHoldCountdown(booking.data?.expires_at)

  const [form, setForm] = useState<PaymentForm>({ operator: null, payerPhone: '' })
  const formError = validate(form)
  const phase = phaseOf(status.data?.status)

  // La tenue a expiré : les places sont libérées côté serveur, et proposer de
  // payer ferait promettre un siège qui n'existe plus.
  if (countdown?.expired === true && phase !== 'succeeded') {
    return (
      <Screen title={t('payment.expired.title')}>
        <View style={styles.centered}>
          <Text style={styles.body}>{t('payment.expired.body')}</Text>
          <Button
            label={t('payment.expired.restart')}
            onPress={() => router.replace('/search')}
          />
        </View>
      </Screen>
    )
  }

  if (phase === 'succeeded') {
    return (
      <Screen title={t('payment.succeeded.title')}>
        <View style={styles.centered}>
          <Text style={styles.body}>{t('payment.succeeded.body')}</Text>
          <Button
            label={t('payment.succeeded.seeTicket')}
            onPress={() => router.replace(`/tickets/${bookingReference}`)}
          />
        </View>
      </Screen>
    )
  }

  if (phase === 'waiting') {
    return (
      <Screen title={t('payment.waiting.title')}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.text.brand} size="large" />
          <Text style={styles.body}>{t('payment.waiting.body')}</Text>
          <Text style={styles.hint}>{t('payment.waiting.patience')}</Text>
          <HoldBanner countdown={countdown} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title={t('payment.title')}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <HoldBanner countdown={countdown} />

        {booking.data === undefined ? null : (
          <View style={styles.amount}>
            <Text style={styles.amountLabel}>{t('payment.amount')}</Text>
            <Text style={styles.amountValue}>
              {formatMoney(booking.data.total, locale)}
            </Text>
          </View>
        )}

        {phase === 'failed' ? (
          <View style={styles.failure}>
            <Text style={styles.failureTitle}>{t('payment.failed.title')}</Text>
            <Text style={styles.body}>{t('payment.failed.body')}</Text>
          </View>
        ) : null}

        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t('payment.operator')}</Text>
          <View style={styles.operators}>
            {OPERATORS.map((operator) => (
              <OperatorChoice
                key={operator}
                operator={operator}
                selected={form.operator === operator}
                onPress={() => setForm((current) => ({ ...current, operator }))}
              />
            ))}
          </View>
        </View>

        <TextField
          label={t('payment.payerPhone')}
          hint={t('payment.payerHint')}
          value={form.payerPhone}
          onChangeText={(value) =>
            setForm((current) => ({ ...current, payerPhone: value }))
          }
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
        />

        {initiate.error ? (
          <Text style={styles.error}>{describe(initiate.error)}</Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={phase === 'failed' ? t('payment.failed.retry') : t('payment.submit')}
          onPress={() => {
            // Après un échec, on repart d'une tentative neuve : réutiliser la
            // précédente renverrait le même refus.
            if (phase === 'failed') initiate.retry()
            initiate.mutate(form)
          }}
          disabled={formError !== null}
          busy={initiate.isPending}
        />
      </View>
    </Screen>
  )
}

function OperatorChoice({
  operator,
  selected,
  onPress,
}: {
  operator: Operator
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={operator}
      onPress={onPress}
      style={[styles.operator, selected ? styles.operatorSelected : null]}
    >
      <Text style={selected ? styles.operatorLabelSelected : styles.operatorLabel}>
        {operator}
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
  body: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  hint: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
    textAlign: 'center',
  },
  amount: {
    gap: spacing.xs / 2,
  },
  amountLabel: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
    textTransform: 'uppercase',
  },
  amountValue: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: theme.text.primary,
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
    textTransform: 'uppercase',
  },
  operators: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  operator: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.surface.border,
    backgroundColor: theme.surface.raised,
  },
  operatorSelected: {
    borderColor: theme.surface.brand,
    backgroundColor: theme.surface.brandSoft,
  },
  operatorLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: theme.text.secondary,
  },
  operatorLabelSelected: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.brand,
  },
  failure: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: theme.surface.raised,
  },
  failureTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.danger,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  error: {
    fontSize: fontSize.base,
    color: theme.text.danger,
  },
})
