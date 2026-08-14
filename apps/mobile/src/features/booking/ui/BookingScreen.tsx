import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { ApiError, NetworkError } from '@motoboy/api-client'
import { errorLabel } from '@motoboy/shared'
import { Button, fontSize, Screen, spacing, theme, TextField } from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useCreateBooking } from '../api/useCreateBooking'
import {
  emptyForm,
  setPassenger,
  validate,
  type BookingForm,
} from '../model/passengerForm'
import { useHoldCountdown } from '../model/useHoldCountdown'
import { HoldBanner } from './HoldBanner'

/**
 * Saisie des passagers, puis prise des places.
 *
 * **Les places sont tenues à l'envoi, pas avant.** Le passager saisit ses noms
 * sur des sièges encore libres pour tout le monde : c'est le prix d'un
 * formulaire qui ne bloque personne, et c'est pourquoi un conflit reste
 * possible ici — l'index unique du serveur arbitre, et le refus se dit
 * clairement plutôt que de se cacher derrière un message générique (B2).
 */
export function BookingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const locale = useLocale()

  const params = useLocalSearchParams<{ reference: string; seats?: string }>()
  const reference = params.reference ?? ''

  /*
   * Les places arrivent en paires `identifiant:numéro`.
   *
   * L'identifiant part au serveur, le numéro s'affiche : montrer « place 4271 »
   * à quelqu'un qui a choisi « 2B » ne lui apprend rien. Les transmettre
   * appariés évite de redemander le plan de sièges au seul motif d'en relire
   * les étiquettes.
   */
  const seats = (params.seats ?? '')
    .split(',')
    .filter((entry) => entry !== '')
    .map((entry) => {
      const [id, label] = entry.split(':')

      return { id: Number(id), label: label ?? '' }
    })

  const [form, setForm] = useState<BookingForm>(() =>
    emptyForm(
      seats.map((seat) => seat.id),
      Math.max(1, seats.length),
    ),
  )

  const create = useCreateBooking(reference)
  const countdown = useHoldCountdown(create.data?.expires_at)
  const error = validate(form)

  function submit() {
    if (error !== null) return

    create.mutate(form, {
      onSuccess: (booking) => {
        router.replace({
          pathname: '/payment',
          params: { reference: booking.reference },
        })
      },
    })
  }

  return (
    <Screen title={t('booking.title')}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <HoldBanner countdown={countdown} />

          {form.passengers.map((passenger, index) => (
            <View key={index} style={styles.group}>
              <Text style={styles.groupTitle}>
                {t('booking.passenger', { index: index + 1 })}
                {passenger.seatId === null
                  ? ''
                  : ` · ${t('booking.seatLabel', { label: seats[index]?.label ?? '' })}`}
              </Text>

              <TextField
                label={t('booking.firstName')}
                value={passenger.firstName}
                onChangeText={(value) =>
                  setForm((f) => setPassenger(f, index, { firstName: value }))
                }
                autoCapitalize="words"
                textContentType="givenName"
              />
              <TextField
                label={t('booking.lastName')}
                value={passenger.lastName}
                onChangeText={(value) =>
                  setForm((f) => setPassenger(f, index, { lastName: value }))
                }
                autoCapitalize="words"
                textContentType="familyName"
              />
            </View>
          ))}

          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('booking.contact')}</Text>
            <TextField
              label={t('booking.contactPhone')}
              hint={t('booking.contactHint')}
              value={form.contactPhone}
              onChangeText={(value) => setForm((f) => ({ ...f, contactPhone: value }))}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
            />
          </View>

          {create.error ? (
            <Conflict
              error={create.error}
              locale={locale}
              onPickAnother={() => router.back()}
            />
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t('booking.submit')}
            onPress={submit}
            disabled={error !== null}
            busy={create.isPending}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

/**
 * Un conflit d'inventaire se dit, et se répare.
 *
 * « Une place vient d'être prise » appelle un geste précis — en choisir une
 * autre — que l'écran propose. Un message générique laisserait le passager
 * réessayer indéfiniment le même siège.
 */
function Conflict({
  error,
  locale,
  onPickAnother,
}: {
  error: unknown
  locale: ReturnType<typeof useLocale>
  onPickAnother: () => void
}) {
  const { t } = useTranslation()

  if (error instanceof NetworkError) {
    return <Text style={styles.error}>{t('state.offline', { ns: 'common' })}</Text>
  }

  if (!(error instanceof ApiError)) {
    return <Text style={styles.error}>{t('state.unexpected', { ns: 'common' })}</Text>
  }

  const recoverable = error.code === 'SEAT_ALREADY_HELD'

  const message = {
    SEAT_ALREADY_HELD: t('booking.conflict.seatTaken'),
    TRIP_FULL: t('booking.conflict.tripFull'),
    ONLINE_SALES_CLOSED: t('booking.conflict.closed'),
  }[error.code as string]

  return (
    <View style={styles.conflict}>
      <Text style={styles.error}>{message ?? errorLabel(error.code, locale)}</Text>
      {recoverable ? (
        <Button
          label={t('booking.conflict.pickAnother')}
          onPress={onPickAnother}
          variant="secondary"
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.muted,
    textTransform: 'uppercase',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  conflict: {
    gap: spacing.sm,
  },
  error: {
    fontSize: fontSize.base,
    color: theme.text.danger,
  },
})
