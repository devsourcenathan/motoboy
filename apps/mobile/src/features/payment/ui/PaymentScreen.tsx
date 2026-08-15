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
  CheckIcon,
  fontSize,
  lineHeight,
  radius,
  Screen,
  sharedStyles,
  spacing,
  TextField,
  theme,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { HoldBanner, Stepper, useHoldCountdown } from '../../../shared/booking'
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
      <Screen>
        <ScrollView contentContainerStyle={styles.doneContent}>
          <View style={styles.seal}>
            <CheckIcon color={theme.text.inverse} size={34} />
          </View>

          <Text style={styles.doneTitle} accessibilityRole="header">
            {t('payment.succeeded.title')}
          </Text>
          <Text style={styles.body}>{t('payment.succeeded.body')}</Text>

          {/*
            La référence en évidence : c'est elle qu'on donne au guichet quand
            le téléphone ne veut plus rien afficher.
          */}
          <View style={styles.referenceBox}>
            <Text style={styles.referenceLabel}>{t('payment.succeeded.reference')}</Text>
            <Text style={styles.referenceValue} selectable>
              {bookingReference}
            </Text>
          </View>

          {booking.data === undefined ? null : (
            <View style={styles.doneCard}>
              <SummaryRow
                label={t('payment.route')}
                value={`${booking.data.trip.origin_station.city} → ${booking.data.trip.destination_station.city}`}
              />
              <SummaryRow
                label={t('payment.agency')}
                value={booking.data.trip.agency.name}
              />
              <SummaryRow
                label={t('payment.seats')}
                value={String(booking.data.seats_count)}
              />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('payment.total')}</Text>
                <Text style={styles.totalValue}>
                  {formatMoney(booking.data.total, locale)}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.hint}>{t('payment.succeeded.notified')}</Text>

          <Button
            label={t('payment.succeeded.seeTicket')}
            // Vers la **liste** : une réservation de trois places produit
            // trois billets, un par passager, et la référence de réservation
            // n'en désigne aucun.
            onPress={() => router.replace('/tickets')}
            style={styles.doneButton}
          />
          <Button
            label={t('payment.succeeded.home')}
            variant="secondary"
            onPress={() => router.replace('/search')}
            style={styles.doneButton}
          />
        </ScrollView>
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
        <Stepper current="payment" />

        <HoldBanner countdown={countdown} />

        {booking.data === undefined ? null : (
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{t('payment.summary')}</Text>

            <SummaryRow
              label={t('payment.agency')}
              value={booking.data.trip.agency.name}
            />
            <SummaryRow
              label={t('payment.route')}
              value={`${booking.data.trip.origin_station.city} → ${booking.data.trip.destination_station.city}`}
            />
            <SummaryRow
              label={t('payment.seats')}
              value={String(booking.data.seats_count)}
            />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('payment.total')}</Text>
              <Text style={styles.totalValue}>
                {formatMoney(booking.data.total, locale)}
              </Text>
            </View>
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
        {booking.data === undefined ? null : (
          <View style={styles.footerAmount}>
            <Text style={styles.footerLabel}>{t('payment.totalToPay')}</Text>
            <Text style={styles.footerValue}>
              {formatMoney(booking.data.total, locale)}
            </Text>
          </View>
        )}

        <Button
          style={styles.footerButton}
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
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
      {/*
        Une pastille radio, et pas seulement un cadre coloré : le choix
        sélectionné doit rester lisible pour qui ne distingue pas le bleu du
        gris, et sur une dalle délavée en plein soleil.
      */}
      <View style={[styles.radio, selected ? styles.radioOn : null]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <Text style={selected ? styles.operatorLabelSelected : styles.operatorLabel}>
        {operator}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  doneContent: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  seal: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.success,
    marginBottom: spacing.base,
  },
  doneTitle: {
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight['2xl'],
    fontWeight: '700',
    color: theme.text.success,
    textAlign: 'center',
  },
  referenceBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    marginTop: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: theme.surface.successSoft,
  },
  referenceLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.text.success,
  },
  referenceValue: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.primary,
  },
  doneCard: {
    ...sharedStyles.card,
    alignSelf: 'stretch',
    gap: spacing.base,
    padding: spacing.md,
    marginTop: spacing.base,
  },
  doneButton: {
    alignSelf: 'stretch',
    marginTop: spacing.base,
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  hint: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
    textAlign: 'center',
  },
  summary: {
    ...sharedStyles.card,
    gap: spacing.base,
    padding: spacing.md,
  },
  summaryTitle: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.surface.border,
  },
  summaryLabel: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  summaryValue: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.primary,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  totalValue: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.brand,
  },
  group: {
    gap: spacing.base,
  },
  groupTitle: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  operators: {
    gap: spacing.base,
  },
  operator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    backgroundColor: theme.surface.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: theme.surface.border,
  },
  operatorSelected: {
    borderColor: theme.surface.brand,
  },
  radio: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: theme.surface.border,
  },
  radioOn: {
    borderColor: theme.surface.brand,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: theme.surface.brand,
  },
  operatorLabel: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
  },
  operatorLabelSelected: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  failure: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: theme.surface.dangerSoft,
  },
  failureTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.onDangerSoft,
  },
  /** Le total reste sous les yeux au moment d'appuyer : c'est ce qu'on engage. */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: theme.surface.card,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  footerAmount: {
    gap: 1,
  },
  footerLabel: {
    ...sharedStyles.sectionLabel,
    color: theme.text.muted,
  },
  footerValue: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.primary,
  },
  footerButton: {
    flex: 1,
  },
  error: {
    fontSize: fontSize.base,
    color: theme.text.danger,
  },
})
