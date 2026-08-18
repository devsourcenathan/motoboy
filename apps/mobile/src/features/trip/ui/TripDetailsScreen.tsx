import { useLocalSearchParams, useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { formatDate, formatDuration, formatMoney, formatTime } from '@motoboy/shared'
import {
  Button,
  CalendarIcon,
  fontSize,
  lineHeight,
  PersonIcon,
  radius,
  RouteDot,
  Screen,
  sharedStyles,
  SkeletonList,
  spacing,
  TabIcon,
  theme,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useTrip } from '../api/useTrip'

/**
 * Le départ, avant de choisir sa place.
 *
 * **Une étape à part, et non le haut du plan de sièges.** Comparer se fait sur
 * la liste ; décider se fait ici, sur des informations qu'on ne peut pas toutes
 * loger dans une carte de résultat — gares exactes, capacité, conditions
 * d'annulation. Le plan de sièges vient après, quand le choix est fait.
 */
export function TripDetailsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const locale = useLocale()
  const describe = useErrorMessage()

  const params = useLocalSearchParams<{ reference: string; passengers?: string }>()
  const reference = params.reference ?? ''
  const passengers = Math.max(1, Number(params.passengers ?? 1) || 1)

  const trip = useTrip(reference)

  if (trip.isPending) {
    return (
      <Screen title={t('trip.details')}>
        <View style={styles.skeleton}>
          <SkeletonList count={3} variant="card" />
        </View>
      </Screen>
    )
  }

  if (trip.data === undefined) {
    return (
      <Screen title={t('trip.details')}>
        <View style={sharedStyles.centered}>
          <Text style={styles.message}>{describe(trip.error)}</Text>
          <Button
            label={t('action.retry', { ns: 'common' })}
            onPress={() => void trip.refetch()}
            variant="secondary"
          />
        </View>
      </Screen>
    )
  }

  const data = trip.data
  const soldOut = data.seats_available <= 0

  return (
    <Screen title={t('trip.details')}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.agency}>
            <View style={styles.initials}>
              <Text style={styles.initialsLabel}>{initialsOf(data.agency.name)}</Text>
            </View>
            <View style={styles.agencyText}>
              <Text style={styles.agencyName} numberOfLines={1}>
                {data.agency.name}
              </Text>
              {data.vehicle_type === undefined ? null : (
                <Text style={styles.agencyKind}>
                  {t(`results.vehicle.${data.vehicle_type}`)}
                </Text>
              )}
            </View>
          </View>

          {/*
            La ligne verticale relie les deux extrémités et porte la durée à
            mi-hauteur : c'est la lecture d'un horaire, pas d'un tableau.
          */}
          <View style={styles.timeline}>
            <Stop
              time={formatTime(data.departure_at, { locale })}
              city={data.origin_station.city}
              station={data.origin_station.name}
              color={theme.route.origin}
            />

            <View style={styles.spine}>
              <View style={styles.spineLine} />
              {data.duration_minutes === null ||
              data.duration_minutes === undefined ? null : (
                <Text style={styles.duration}>
                  {formatDuration(data.duration_minutes, locale)}
                </Text>
              )}
            </View>

            <Stop
              time={
                data.arrival_estimate_at === null || data.arrival_estimate_at === undefined
                  ? '—'
                  : formatTime(data.arrival_estimate_at, { locale })
              }
              city={data.destination_station.city}
              station={data.destination_station.name}
              color={theme.route.destination}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('trip.details')}</Text>

          <Row
            icon={<CalendarIcon color={theme.text.muted} size={18} />}
            label={t('trip.date')}
            value={formatDate(data.departure_at, { locale })}
          />
          {data.vehicle_type === undefined ? null : (
            <Row
              icon={<TabIcon name="trips" color={theme.text.muted} size={18} />}
              label={t('trip.busType')}
              value={t(`results.vehicle.${data.vehicle_type}`)}
            />
          )}
          <Row
            icon={<PersonIcon color={theme.text.muted} size={18} />}
            label={t('trip.capacity')}
            value={t('trip.seatsUnit', { count: data.capacity })}
          />
          <Row
            icon={<PersonIcon color={theme.text.muted} size={18} />}
            label={t('trip.available')}
            value={
              soldOut
                ? t('results.soldOut')
                : t('trip.seatsUnit', { count: data.seats_available })
            }
            tone={soldOut ? 'danger' : 'success'}
          />
          {/*
            Les conditions d'annulation figurent ici parce qu'elles varient
            d'une agence à l'autre : c'est un critère de choix, pas une clause
            qu'on découvre après coup (B5).
          */}
          {data.cancellation_policy === undefined ? null : (
            <Row
              icon={<CalendarIcon color={theme.text.muted} size={18} />}
              label={t('cancellation.title')}
              value={
                data.cancellation_policy.fee_value === 0
                  ? t('results.freeCancellation', {
                      hours: data.cancellation_policy.deadline_hours,
                    })
                  : t('results.cancellationFee', {
                      fee:
                        data.cancellation_policy.fee_type === 'PERCENTAGE'
                          ? `${data.cancellation_policy.fee_value / 100}%`
                          : formatMoney(
                              {
                                amount: data.cancellation_policy.fee_value,
                                currency: data.price.currency,
                              },
                              locale,
                            ),
                      hours: data.cancellation_policy.deadline_hours,
                    })
              }
            />
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>{formatMoney(data.price, locale)}</Text>
          <Text style={styles.priceLabel}>{t('trip.pricePerPassenger')}</Text>
        </View>

        <Button
          style={styles.cta}
          label={t('trip.choose')}
          disabled={soldOut}
          onPress={() =>
            router.push({
              pathname: '/trip/[reference]/seats',
              params: { reference, passengers: String(passengers) },
            })
          }
        />
      </View>
    </Screen>
  )
}

function Stop({
  time,
  city,
  station,
  color,
}: {
  time: string
  city: string
  station: string
  color: string
}) {
  return (
    <View style={styles.stop}>
      <Text style={styles.time}>{time}</Text>
      <RouteDot color={color} size={12} />
      <View style={styles.place}>
        <Text style={styles.city} numberOfLines={1}>
          {city}
        </Text>
        <Text style={styles.station} numberOfLines={1}>
          {station}
        </Text>
      </View>
    </View>
  )
}

function Row({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  tone?: 'success' | 'danger'
}) {
  return (
    <View style={styles.row}>
      {icon}
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          tone === 'success' ? styles.rowValueOk : null,
          tone === 'danger' ? styles.rowValueBad : null,
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  )
}

/** Pastille d'agence, à défaut de logo : deux lettres valent mieux qu'un vide. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

const styles = StyleSheet.create({
  /* L'enveloppe des squelettes : même gouttière que le contenu réel. */
  skeleton: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    ...sharedStyles.card,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  agency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  initials: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.inkSoft,
  },
  initialsLabel: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: theme.text.ink,
  },
  agencyText: {
    flex: 1,
    gap: 1,
  },
  agencyName: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  agencyKind: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  timeline: {
    gap: 2,
  },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  time: {
    width: 56,
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  place: {
    flex: 1,
    gap: 1,
  },
  city: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  station: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
  spine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Aligné sur la colonne des pastilles.
    paddingLeft: 56 + spacing.sm + 5,
  },
  spineLine: {
    width: 2,
    height: 28,
    backgroundColor: theme.surface.border,
  },
  duration: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.base,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    color: theme.text.secondary,
  },
  rowValue: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.primary,
    textAlign: 'right',
  },
  rowValueOk: {
    color: theme.text.success,
  },
  rowValueBad: {
    color: theme.text.danger,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: theme.surface.card,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  priceBlock: {
    gap: 1,
  },
  price: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.brand,
  },
  priceLabel: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
  cta: {
    flex: 1,
  },
  message: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
})
