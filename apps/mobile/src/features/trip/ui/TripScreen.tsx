import { useLocalSearchParams, useRouter } from 'expo-router'
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
import type { Seat } from '@motoboy/api-client/types'
import { formatMoney, formatTime } from '@motoboy/shared'
import { Button, fontSize, Screen, spacing, theme } from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useCurrentUser } from '../../account'
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
  const router = useRouter()
  const locale = useLocale()
  const describe = useErrorMessage()
  const params = useLocalSearchParams<{ reference: string; passengers?: string }>()
  const reference = params.reference ?? ''
  const passengers = Math.max(1, Number(params.passengers ?? 1) || 1)

  const me = useCurrentUser()
  const trip = useTrip(reference)
  const seats = useSeatMap(reference)
  const [selected, setSelected] = useState<readonly number[]>([])

  function toggle(seat: Seat) {
    setSelected((current) => toggleSeat(current, seat, passengers))
  }

  /** Les numéros des places choisies, dans l'ordre du plan. */
  const chosenLabels = (seats.data?.seats ?? [])
    .filter((seat) => selected.includes(seat.id))
    .map((seat) => seat.label)

  /*
   * Les places partent appariées `identifiant:numéro`.
   *
   * L'identifiant sert au serveur, le numéro s'affiche au passager. Les
   * transmettre ensemble évite à l'écran suivant de redemander le plan au seul
   * motif d'en relire les étiquettes.
   */
  function goToBooking() {
    const chosen = (seats.data?.seats ?? []).filter((seat) => selected.includes(seat.id))

    const destination = {
      pathname: '/booking' as const,
      params: {
        reference,
        seats: chosen.map((seat) => `${seat.id}:${seat.label}`).join(','),
      },
    }

    /*
     * La connexion n'est demandée qu'ici.
     *
     * Recherche, résultats et plan de sièges fonctionnent sans compte : exiger
     * une session d'entrée ferait renoncer quelqu'un qui veut seulement savoir
     * s'il y a un car ce soir (§35). Mais réserver écrit au nom de quelqu'un,
     * et l'API l'exige — autant le demander au moment où cela se comprend.
     *
     * La destination voyage avec : renvoyer sur l'accueil après connexion
     * obligerait à refaire toute la recherche.
     */
    if (me.data === null || me.data === undefined) {
      router.push({
        pathname: '/account/sign-in',
        params: {
          next: `/booking?reference=${reference}&seats=${destination.params.seats}`,
        },
      })

      return
    }

    router.push(destination)
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
          <Text style={styles.error}>{describe(trip.error)}</Text>
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
        {/*
          Ce qu'on emporte et ce que ça coûte, avant d'appuyer. Le total se
          recalcule à chaque place : découvrir le montant à l'écran suivant est
          exactement ce qu'un pied de page existe pour éviter.
        */}
        {seated ? (
          <View style={styles.chosen}>
            <Text style={styles.chosenLabel}>{t('trip.selectedSeats')}</Text>
            <Text style={styles.chosenValue}>
              {selected.length === 0
                ? t('trip.seatsChosen', { chosen: 0, total: passengers })
                : chosenLabels.join(' · ')}
            </Text>
          </View>
        ) : null}

        {trip.data === undefined ? null : (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('trip.total')}</Text>
            <Text style={styles.totalValue}>
              {formatMoney(
                {
                  amount: trip.data.price.amount * Math.max(1, selected.length || passengers),
                  currency: trip.data.price.currency,
                },
                locale,
              )}
            </Text>
          </View>
        )}

        <Button label={t('trip.continue')} onPress={goToBooking} disabled={!ready} />
      </View>
    </Screen>
  )
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
    padding: spacing.md,
    gap: spacing.base,
    backgroundColor: theme.surface.card,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chosenLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    color: theme.text.secondary,
  },
  chosenValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.primary,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  totalValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: theme.text.brand,
  },
  error: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
})
