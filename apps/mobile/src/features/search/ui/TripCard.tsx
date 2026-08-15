import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { formatDuration, formatMoney, formatTime, type Locale } from '@motoboy/shared'
import type { TripSummary } from '@motoboy/api-client/types'
import {
  fontSize,
  lineHeight,
  radius,
  RouteDot,
  sharedStyles,
  spacing,
  theme,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'

export interface TripCardProps {
  trip: TripSummary
  onPress: () => void
}

/**
 * Un départ dans la liste des résultats.
 *
 * Quatre informations décident : l'heure, le prix, l'agence, les places
 * restantes. **Et les conditions d'annulation** — elles varient d'une agence à
 * l'autre, et c'est précisément ce qui en fait un critère de comparaison plutôt
 * qu'une ligne de conditions générales que personne ne lit (B5).
 *
 * Trois bandes, comme sur la maquette : qui transporte, quand on part et quand
 * on arrive, ce que ça coûte. La ligne du milieu porte les repères or et bleu
 * qui se retrouvent sur le billet — le trajet se lit sans lire les libellés.
 */
export function TripCard({ trip, onPress }: TripCardProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const soldOut = trip.seats_available <= 0

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trip.agency.name}, ${formatTime(trip.departure_at, { locale })}, ${formatMoney(trip.price, locale)}`}
      onPress={onPress}
      disabled={soldOut}
      style={({ pressed }) => [
        styles.card,
        pressed && !soldOut ? styles.pressed : null,
        soldOut ? styles.soldOut : null,
      ]}
    >
      <View style={styles.header}>
        <Initials name={trip.agency.name} />
        <Text style={styles.agency} numberOfLines={1}>
          {trip.agency.name}
        </Text>
        {trip.vehicle_type === undefined ? null : (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>
              {t(`results.vehicle.${trip.vehicle_type}`)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.journey}>
        <View style={styles.end}>
          <Text style={styles.time}>{formatTime(trip.departure_at, { locale })}</Text>
          <Text style={styles.station} numberOfLines={1}>
            {trip.origin_station.name}
          </Text>
        </View>

        <View style={styles.line}>
          {trip.duration_minutes === null || trip.duration_minutes === undefined ? null : (
            <Text style={styles.duration}>
              {formatDuration(trip.duration_minutes, locale)}
            </Text>
          )}
          <View style={styles.track}>
            <RouteDot color={theme.route.origin} size={10} />
            <View style={styles.rail} />
            <RouteDot color={theme.route.destination} size={10} />
          </View>
          <Text style={styles.stops} numberOfLines={1}>
            {/*
              Les escales sont **purement informatives** : la réservation est
              point-à-point, et une ville d'escale ne rend pas ce départ
              réservable jusqu'à elle (B6).
            */}
            {trip.stops === undefined || trip.stops.length === 0
              ? t('results.directOnly')
              : t('results.via', { stops: trip.stops.map((stop) => stop.city).join(', ') })}
          </Text>
        </View>

        <View style={[styles.end, styles.endRight]}>
          <Text style={styles.time}>
            {trip.arrival_estimate_at === null || trip.arrival_estimate_at === undefined
              ? '—'
              : formatTime(trip.arrival_estimate_at, { locale })}
          </Text>
          <Text style={[styles.station, styles.stationRight]} numberOfLines={1}>
            {trip.destination_station.name}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>{formatMoney(trip.price, locale)}</Text>
          <Text style={soldOut ? styles.seatsNone : styles.seats}>
            {soldOut
              ? t('results.soldOut')
              : t('results.seatsLeft', { count: trip.seats_available })}
          </Text>
          <Text style={styles.policy}>{cancellationLabel(trip, t, locale)}</Text>
        </View>

        {/*
          Faux bouton : la carte entière est déjà pressable, et deux cibles
          superposées feraient annoncer deux fois la même action au lecteur
          d'écran. Il n'est là que pour dire où appuyer.
        */}
        {soldOut ? null : (
          <View style={styles.choose} importantForAccessibility="no-hide-descendants">
            <Text style={styles.chooseLabel}>{t('results.choose')}</Text>
          </View>
        )}
      </View>
    </Pressable>
  )
}

/** Pastille d'agence, à défaut de logo : deux lettres valent mieux qu'un vide. */
function Initials({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')

  return (
    <View style={styles.initials}>
      <Text style={styles.initialsLabel}>{letters}</Text>
    </View>
  )
}

function cancellationLabel(
  trip: TripSummary,
  t: (key: string, options?: Record<string, unknown>) => string,
  locale: Locale,
): string {
  const policy = trip.cancellation_policy

  if (policy === undefined) return ''

  // Frais nuls : c'est un argument commercial, il se dit comme tel.
  if (policy.fee_value === 0) {
    return t('results.freeCancellation', { hours: policy.deadline_hours })
  }

  const fee =
    policy.fee_type === 'PERCENTAGE'
      ? // Points de base : 2000 vaut 20 %.
        `${policy.fee_value / 100}%`
      : formatMoney({ amount: policy.fee_value, currency: trip.price.currency }, locale)

  return t('results.cancellationFee', { fee, hours: policy.deadline_hours })
}

const styles = StyleSheet.create({
  card: {
    ...sharedStyles.card,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
  },
  soldOut: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    backgroundColor: theme.surface.raised,
  },
  initials: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.inkSoft,
  },
  initialsLabel: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: theme.text.ink,
  },
  agency: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.primary,
  },
  badge: {
    paddingHorizontal: spacing.base,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: theme.surface.inert,
  },
  badgeLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: theme.text.secondary,
  },
  journey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    padding: spacing.sm,
  },
  end: {
    width: 76,
  },
  endRight: {
    alignItems: 'flex-end',
  },
  time: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  station: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
  stationRight: {
    textAlign: 'right',
  },
  line: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  duration: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  rail: {
    flex: 1,
    height: 2,
    marginHorizontal: 2,
    borderRadius: radius.full,
    backgroundColor: theme.surface.border,
  },
  stops: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  priceBlock: {
    flex: 1,
    gap: 1,
  },
  price: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.brand,
  },
  seats: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: theme.text.danger,
  },
  seatsNone: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: theme.text.muted,
  },
  policy: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
  choose: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: theme.surface.brand,
  },
  chooseLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.inverse,
  },
})
