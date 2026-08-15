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
import { ApiError } from '@motoboy/api-client'
import {
  Button,
  fontSize,
  lineHeight,
  radius,
  Screen,
  sharedStyles,
  spacing,
  theme,
  TextField,
} from '../../../shared/ui'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { HoldBanner, Stepper, useHoldCountdown } from '../../../shared/booking'
import { useCreateBooking } from '../api/useCreateBooking'
import {
  emptyForm,
  setPassenger,
  validate,
  type BookingForm,
} from '../model/passengerForm'

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
    <Screen title={t('booking.title')} subtitle={t('booking.subtitle')}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Stepper current="details" />

          <HoldBanner countdown={countdown} />

          {form.passengers.map((passenger, index) => (
            <View key={index} style={styles.group}>
              <View style={styles.groupHead}>
                {/*
                  Le premier voyageur porte une pastille or : c'est lui qui
                  reçoit le SMS et dont le nom figure sur le contact, ce qui
                  n'est évident pour personne sans le dire.
                */}
                <View style={[styles.rank, index === 0 ? styles.rankFirst : null]}>
                  <Text
                    style={[styles.rankLabel, index === 0 ? styles.rankLabelFirst : null]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text style={styles.groupTitle}>
                  {index === 0
                    ? t('booking.mainPassenger')
                    : t('booking.passenger', { index: index + 1 })}
                </Text>
                {passenger.seatId === null ? null : (
                  <View style={styles.seatChip}>
                    <Text style={styles.seatChipLabel}>{seats[index]?.label ?? ''}</Text>
                  </View>
                )}
              </View>

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
            <View style={styles.groupHead}>
              <Text style={styles.groupTitle}>{t('booking.contact')}</Text>
            </View>
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
            <Conflict error={create.error} onPickAnother={() => router.back()} />
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
  onPickAnother,
}: {
  error: unknown
  onPickAnother: () => void
}) {
  const { t } = useTranslation()
  const describe = useErrorMessage()

  if (!(error instanceof ApiError)) {
    return <Text style={styles.error}>{describe(error)}</Text>
  }

  const recoverable = error.code === 'SEAT_ALREADY_HELD'

  // Trois conflits d'inventaire ont un texte à eux, parce qu'ils appellent des
  // gestes différents. Le reste retombe sur le libellé générique du code.
  const message = {
    SEAT_ALREADY_HELD: t('booking.conflict.seatTaken'),
    TRIP_FULL: t('booking.conflict.tripFull'),
    ONLINE_SALES_CLOSED: t('booking.conflict.closed'),
  }[error.code as string]

  return (
    <View style={styles.conflict}>
      <Text style={styles.error}>{message ?? describe(error)}</Text>
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
    padding: spacing.md,
    gap: spacing.md,
  },
  /** Chaque voyageur dans sa carte : la limite entre deux saisies se voit. */
  group: {
    ...sharedStyles.card,
    gap: spacing.sm,
    padding: spacing.md,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.surface.border,
  },
  rank: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.inert,
  },
  rankFirst: {
    backgroundColor: theme.surface.brandSoft,
  },
  rankLabel: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: theme.text.secondary,
  },
  rankLabelFirst: {
    color: theme.text.brand,
  },
  groupTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  seatChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: theme.surface.brandSoft,
  },
  seatChipLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: theme.text.brand,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: theme.surface.card,
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
