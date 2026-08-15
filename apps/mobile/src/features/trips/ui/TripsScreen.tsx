import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { bookingStatusLabels, formatDateTime, formatMoney } from '@motoboy/shared'
import type { Booking } from '@motoboy/api-client/types'
import {
  Button,
  fontSize,
  lineHeight,
  radius,
  RouteDot,
  Screen,
  sharedStyles,
  spacing,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useBookings } from '../api/useBookings'

type Tab = 'upcoming' | 'past'

/**
 * Mes voyages — la liste des réservations.
 *
 * **Une réservation n'est pas un billet.** Trois places réservées donnent trois
 * billets, un par personne qui embarque ; la réservation, elle, porte le
 * paiement, le montant et l'annulation. Les deux onglets existent parce que les
 * deux questions se posent : « combien ai-je payé » et « quel code je montre ».
 */
export function TripsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const locale = useLocale()
  const describe = useErrorMessage()

  const [tab, setTab] = useState<Tab>('upcoming')
  const bookings = useBookings()

  if (bookings.isPending) {
    return (
      <Screen title={t('tabs.trips')}>
        <View style={sharedStyles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      </Screen>
    )
  }

  if (bookings.data === undefined) {
    return (
      <Screen title={t('tabs.trips')}>
        <View style={sharedStyles.centered}>
          <Text style={styles.message}>{describe(bookings.error)}</Text>
          <Button
            label={t('action.retry', { ns: 'common' })}
            onPress={() => void bookings.refetch()}
            variant="secondary"
          />
        </View>
      </Screen>
    )
  }

  /*
   * « À venir » = tout ce qui peut encore servir. Une réservation annulée ou
   * dont le départ est passé bascule dans l'historique — la garder en tête de
   * liste ferait chercher le voyage du jour sous des voyages morts.
   */
  const upcoming = bookings.data.filter(
    (booking) =>
      booking.status === 'CONFIRMED' || booking.status === 'PENDING_PAYMENT',
  )
  const past = bookings.data.filter(
    (booking) => !(booking.status === 'CONFIRMED' || booking.status === 'PENDING_PAYMENT'),
  )
  const shown = tab === 'upcoming' ? upcoming : past

  return (
    <Screen title={t('tabs.trips')}>
      <View style={styles.switcher}>
        <Segment
          label={t('ticket.upcoming')}
          active={tab === 'upcoming'}
          onPress={() => setTab('upcoming')}
        />
        <Segment
          label={t('ticket.history')}
          active={tab === 'past'}
          onPress={() => setTab('past')}
        />
      </View>

      <FlatList
        data={shown}
        keyExtractor={(booking) => booking.reference}
        contentContainerStyle={styles.list}
        refreshing={bookings.isFetching}
        onRefresh={() => void bookings.refetch()}
        ListEmptyComponent={
          <View style={sharedStyles.centered}>
            <Text style={styles.message}>{t('account.historyEmpty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <BookingCard
            booking={item}
            locale={locale}
            onPress={() => router.push('/tickets')}
          />
        )}
      />
    </Screen>
  )
}

/** Bascule à deux segments : orange plein pour l'onglet courant. */
function Segment({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segment, active ? styles.segmentActive : null]}
    >
      <Text style={[styles.segmentLabel, active ? styles.segmentLabelActive : null]}>
        {label}
      </Text>
    </Pressable>
  )
}

function BookingCard({
  booking,
  locale,
  onPress,
}: {
  booking: Booking
  locale: ReturnType<typeof useLocale>
  onPress: () => void
}) {
  const { t } = useTranslation()
  const confirmed = booking.status === 'CONFIRMED'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${booking.reference}, ${booking.trip.origin_station.city} → ${booking.trip.destination_station.city}, ${bookingStatusLabels[locale][booking.status]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
    >
      <View style={styles.head}>
        <Text style={styles.reference}>{booking.reference}</Text>
        <View style={[styles.chip, confirmed ? styles.chipOk : null]}>
          <Text style={[styles.chipLabel, confirmed ? styles.chipLabelOk : null]}>
            {bookingStatusLabels[locale][booking.status]}
          </Text>
        </View>
      </View>

      <View style={styles.route}>
        <RouteDot color={theme.route.origin} size={10} />
        <Text style={styles.city} numberOfLines={1}>
          {booking.trip.origin_station.city}
        </Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.city} numberOfLines={1}>
          {booking.trip.destination_station.city}
        </Text>
        <RouteDot color={theme.route.destination} size={10} />
      </View>

      <Text style={styles.when}>
        {formatDateTime(booking.trip.departure_at, { locale })}
      </Text>

      <View style={styles.foot}>
        <Text style={styles.agency} numberOfLines={1}>
          {booking.trip.agency.name}
        </Text>
        <Text style={styles.total}>{formatMoney(booking.total, locale)}</Text>
      </View>

      {/*
        Faux bouton : la carte entière est déjà pressable, et deux cibles
        superposées annonceraient deux fois la même action.
      */}
      {confirmed ? (
        <View style={styles.cta} importantForAccessibility="no-hide-descendants">
          <Text style={styles.ctaLabel}>{t('ticket.seeQr')}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  switcher: {
    flexDirection: 'row',
    gap: spacing.base,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.base,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: theme.surface.inert,
  },
  segmentActive: {
    backgroundColor: theme.surface.brand,
  },
  segmentLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.secondary,
  },
  segmentLabelActive: {
    color: theme.text.inverse,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    ...sharedStyles.card,
    gap: spacing.base,
    padding: spacing.md,
  },
  cardPressed: {
    backgroundColor: theme.surface.raised,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  reference: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: theme.text.muted,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: theme.surface.inert,
  },
  chipOk: {
    backgroundColor: theme.surface.successSoft,
  },
  chipLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: theme.text.secondary,
  },
  chipLabelOk: {
    color: theme.text.success,
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  city: {
    flexShrink: 1,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  arrow: {
    fontSize: fontSize.base,
    color: theme.text.muted,
  },
  when: {
    fontSize: fontSize.sm,
    color: theme.text.secondary,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  agency: {
    flex: 1,
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  total: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '800',
    color: theme.text.brand,
  },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET - 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  ctaLabel: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.ink,
  },
  message: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
})
