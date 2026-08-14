import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { formatDuration, formatMoney, formatTime, type Locale } from '@motoboy/shared'
import type { TripSummary } from '@motoboy/api-client/types'
import { fontSize, radius, spacing, theme } from '../../../shared/ui'

export interface TripCardProps {
  trip: TripSummary
  locale: Locale
  onPress: () => void
}

/**
 * Un départ dans la liste des résultats.
 *
 * Quatre informations décident : l'heure, le prix, l'agence, les places
 * restantes. **Et les conditions d'annulation** — elles varient d'une agence à
 * l'autre, et c'est précisément ce qui en fait un critère de comparaison plutôt
 * qu'une ligne de conditions générales que personne ne lit (B5).
 */
export function TripCard({ trip, locale, onPress }: TripCardProps) {
  const { t } = useTranslation()
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
        <Text style={styles.time}>{formatTime(trip.departure_at, { locale })}</Text>
        <Text style={styles.price}>{formatMoney(trip.price, locale)}</Text>
      </View>

      <Text style={styles.agency}>{trip.agency.name}</Text>

      <View style={styles.meta}>
        {trip.duration_minutes === null || trip.duration_minutes === undefined ? null : (
          <Text style={styles.metaItem}>
            {formatDuration(trip.duration_minutes, locale)}
          </Text>
        )}
        <Text style={styles.metaItem}>
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

      <View style={styles.footer}>
        <Text style={soldOut ? styles.seatsNone : styles.seats}>
          {soldOut
            ? t('results.soldOut')
            : t('results.seatsLeft', { count: trip.seats_available })}
        </Text>
        <Text style={styles.policy}>{cancellationLabel(trip, t, locale)}</Text>
      </View>
    </Pressable>
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
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: theme.surface.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  pressed: {
    opacity: 0.85,
  },
  soldOut: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: theme.text.primary,
  },
  price: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text.brand,
  },
  agency: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metaItem: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  footer: {
    marginTop: spacing.xs,
    gap: spacing.xs / 2,
  },
  seats: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.seat.available,
  },
  seatsNone: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text.muted,
  },
  policy: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
})
