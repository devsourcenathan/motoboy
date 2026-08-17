import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { formatMoney } from '@motoboy/shared'
import {
  Button,
  fontSize,
  lineHeight,
  radius,
  Screen,
  sharedStyles,
  spacing,
  theme,
  TimerIcon,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import {
  useCompleteRide,
  useMyOffers,
  useMyRides,
  useStartRide,
  type DriverRide,
} from '../api/useDriverWork'

/** Les états d'une course qui n'est pas finie. */
const LIVE = ['MATCHED', 'IN_PROGRESS'] as const

/**
 * Ses offres, ses courses, et celle qu'il conduit (C6, C7).
 *
 * **Un écran, parce que c'est une seule question : où j'en suis ?** Une offre
 * acceptée devient une course, et séparer les deux listes ferait chercher dans
 * l'autre ce qui vient de bouger.
 *
 * La course en cours passe devant tout : il n'y en a qu'une à la fois, garantie
 * par un index unique partiel côté base, et c'est la seule chose sur laquelle il
 * ait à agir.
 */
export function DriverRidesScreen() {
  const { t } = useTranslation()
  const locale = useLocale()
  const describe = useErrorMessage()

  const rides = useMyRides()
  const offers = useMyOffers()

  const start = useStartRide()
  const complete = useCompleteRide()

  const all = rides.data?.data ?? []
  const live = all.find((ride) => LIVE.includes(ride.status as (typeof LIVE)[number]))
  const past = all.filter((ride) => ride !== live)
  const pending = (offers.data?.data ?? []).filter((offer) => offer.status === 'PENDING')

  if (rides.isPending) {
    return (
      <Screen title={t('driver.myRides')}>
        <View style={sharedStyles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title={t('driver.myRides')}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={rides.isFetching || offers.isFetching}
            onRefresh={() => {
              void rides.refetch()
              void offers.refetch()
            }}
            tintColor={theme.text.brand}
          />
        }
      >
        {rides.isError ? <Text style={styles.error}>{describe(rides.error)}</Text> : null}

        {live === undefined ? null : (
          <View style={styles.live}>
            <Text style={styles.liveTitle}>{t('driver.currentRide')}</Text>

            <Text style={styles.price}>{formatMoney(live.price, locale)}</Text>
            {/*
              Ce qu'il touche, pas ce que le passager paie : la commission est
              prélevée par la plateforme, et afficher le brut ferait croire à une
              retenue surprise au moment du reversement.
            */}
            <Text style={styles.earned}>
              {t('driver.earned')} {formatMoney(live.driver_amount, locale)}
            </Text>

            {/*
              Le téléphone du passager n'apparaît qu'une fois la course payée :
              avant, il n'y a pas de course à honorer, et le donner inviterait à
              s'arranger en direct.
            */}
            {live.paid ? (
              <Contact
                label={[live.passenger.first_name, live.passenger.last_name]
                  .filter((part) => part !== null)
                  .join(' ')}
                phone={live.passenger.phone}
              />
            ) : (
              <View style={styles.waiting}>
                <TimerIcon color={theme.text.muted} size={16} />
                <Text style={styles.waitingText}>{t('driver.awaitingPayment')}</Text>
              </View>
            )}

            {live.status === 'MATCHED' ? (
              <Button
                label={t('driver.startRide')}
                disabled={!live.paid}
                busy={start.isPending}
                onPress={() => start.mutate(live.reference)}
              />
            ) : (
              <Button
                label={t('driver.completeRide')}
                busy={complete.isPending}
                onPress={() => complete.mutate(live.reference)}
              />
            )}

            {start.error ? <Text style={styles.error}>{describe(start.error)}</Text> : null}
            {complete.error ? (
              <Text style={styles.error}>{describe(complete.error)}</Text>
            ) : null}
          </View>
        )}

        {pending.length === 0 ? null : (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('driver.myOffers')}</Text>
            {pending.map((offer) => (
              <View key={offer.id} style={styles.row}>
                <Text style={styles.rowPrice}>{formatMoney(offer.price, locale)}</Text>
                <Text style={styles.rowState}>{t('driver.offerPending')}</Text>
              </View>
            ))}
          </View>
        )}

        {past.length === 0 && live === undefined ? (
          <View style={styles.empty}>
            <Text style={styles.body}>{t('driver.myRidesEmpty')}</Text>
          </View>
        ) : null}

        {past.length === 0 ? null : (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('driver.myRides')}</Text>
            {past.map((ride) => (
              <PastRide key={ride.reference} ride={ride} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

function PastRide({ ride }: { ride: DriverRide }) {
  const { t } = useTranslation()
  const locale = useLocale()

  const label =
    ride.status === 'COMPLETED'
      ? t('driver.rideDone')
      : ride.status === 'CANCELLED'
        ? t('serviceCall.cancelled')
        : ride.status

  return (
    <View style={styles.row}>
      <Text style={styles.rowPrice}>
        {formatMoney(ride.driver_amount, locale)}
      </Text>
      <Text style={styles.rowState}>{label}</Text>
    </View>
  )
}

/**
 * Le passager, joignable.
 *
 * Le numéro est **appelable** plutôt qu'affiché seul : la seule chose qu'un
 * chauffeur en fait est téléphoner, et le recopier à la main sur un téléphone en
 * conduisant est exactement ce qu'il ne faut pas demander.
 */
function Contact({ label, phone }: { label: string; phone: string | null }) {
  return (
    <View style={styles.contact}>
      <Text style={styles.contactName}>{label}</Text>
      {phone === null ? null : (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={phone}
          onPress={() => void Linking.openURL(`tel:${phone}`)}
        >
          <Text style={styles.contactPhone}>{phone}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  live: {
    ...sharedStyles.card,
    gap: spacing.base,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: theme.text.brand,
  },
  liveTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.brand,
    textTransform: 'uppercase',
  },
  price: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.primary,
  },
  earned: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text.success,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  waitingText: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  contact: {
    gap: 2,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: theme.surface.raised,
  },
  contactName: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  contactPhone: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.brand,
  },
  group: {
    gap: spacing.base,
  },
  groupTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  row: {
    ...sharedStyles.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  rowPrice: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  rowState: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  error: {
    fontSize: fontSize.sm,
    color: theme.text.danger,
  },
})
