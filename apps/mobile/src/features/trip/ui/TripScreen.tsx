import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { ApiError, NetworkError } from '@motoboy/api-client'
import type { Seat } from '@motoboy/api-client/types'
import { errorLabel, formatMoney, formatTime } from '@motoboy/shared'
import { Button, fontSize, Screen, spacing, theme } from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useSeatMap, useTrip } from '../api/useTrip'
import { hasSeatMap, isComplete, toggleSeat } from '../model/seatSelection'
import { SeatGrid } from './SeatGrid'
import { SeatLegend } from './SeatLegend'

/**
 * Détail d'un départ et choix des places.
 *
 * **L'écran affiche, il ne décide pas.** La disponibilité vient du serveur à
 * chaque consultation, et c'est l'index unique partiel qui arbitre au moment de
 * réserver : deux passagers peuvent viser le même siège à la seconde près, et
 * seul le second recevra un refus (B2). Le plan n'est donc jamais une promesse.
 */
export function TripScreen() {
  const { t } = useTranslation()
  const locale = useLocale()
  const params = useLocalSearchParams<{ reference: string; passengers?: string }>()
  const reference = params.reference ?? ''
  const passengers = Math.max(1, Number(params.passengers ?? 1) || 1)

  const trip = useTrip(reference)
  const seats = useSeatMap(reference)
  const [selected, setSelected] = useState<readonly number[]>([])

  function toggle(seat: Seat) {
    setSelected((current) => toggleSeat(current, seat, passengers))
  }

  if (trip.isPending) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      </Screen>
    )
  }

  if (trip.error) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.error}>{describe(trip.error, locale, t)}</Text>
          <Button
            label={t('action.retry', { ns: 'common' })}
            onPress={() => void trip.refetch()}
            variant="secondary"
          />
        </View>
      </Screen>
    )
  }

  const detail = trip.data
  const map = seats.data
  const seated = hasSeatMap(map)
  const ready = isComplete(selected, passengers, map)

  return (
    <Screen title={detail.agency.name}>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          // Le plan vieillit vite : le tirer pour rafraîchir est le geste
          // naturel quand une place vient d'être prise sous les yeux.
          <RefreshControl
            refreshing={seats.isFetching}
            onRefresh={() => void seats.refetch()}
          />
        }
      >
        <View style={styles.summary}>
          <Text style={styles.time}>{formatTime(detail.departure_at, { locale })}</Text>
          <Text style={styles.route}>
            {detail.origin_station.city} → {detail.destination_station.city}
          </Text>
          <Text style={styles.price}>{formatMoney(detail.price, locale)}</Text>
        </View>

        {seats.isPending ? (
          <ActivityIndicator color={theme.text.brand} />
        ) : seated ? (
          <>
            <Text style={styles.heading}>{t('trip.seatMap')}</Text>
            <SeatLegend />
            <SeatGrid seats={map?.seats ?? []} selected={selected} onToggle={toggle} />
            <Text style={styles.hint}>{t('trip.heldHint')}</Text>
          </>
        ) : (
          // Mode capacité : il n'y a pas de plan à montrer, et prétendre le
          // contraire obligerait à inventer des sièges qui n'existent pas.
          <Text style={styles.hint}>{t('trip.capacityMode')}</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {seated ? (
          <Text style={styles.count}>
            {t('trip.seatsChosen', { chosen: selected.length, total: passengers })}
          </Text>
        ) : null}
        <Button label={t('trip.continue')} onPress={() => undefined} disabled={!ready} />
      </View>
    </Screen>
  )
}

function describe(
  error: unknown,
  locale: ReturnType<typeof useLocale>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (error instanceof ApiError) return errorLabel(error.code, locale)
  if (error instanceof NetworkError) return t('state.offline', { ns: 'common' })

  return t('state.unexpected', { ns: 'common' })
}

const styles = StyleSheet.create({
  body: {
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
  summary: {
    gap: spacing.xs,
  },
  time: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: theme.text.primary,
  },
  route: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
  },
  price: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text.brand,
  },
  heading: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  hint: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  count: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
    textAlign: 'center',
  },
  error: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
})
