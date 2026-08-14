import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { formatDate, formatTime, ticketStatusLabels } from '@motoboy/shared'
import type { Ticket } from '@motoboy/api-client/types'
import {
  Button,
  CalendarIcon,
  fontSize,
  lineHeight,
  radius,
  RouteDot,
  Screen,
  sharedStyles,
  spacing,
  theme,
  TimerIcon,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useTickets } from '../api/useTickets'

/**
 * Les billets du passager.
 *
 * Une réservation de trois places produit **trois billets**, un par passager :
 * chacun embarque avec le sien, et rien ne garantit qu'ils voyagent ensemble
 * jusqu'au portique. La liste est donc le point d'arrivée après paiement, pas
 * un billet unique.
 *
 * **Deux sections, à venir puis historique.** Un passager qui ouvre cet écran en
 * gare cherche le billet du jour ; le faire défiler à travers ses trajets
 * passés, c'est lui faire perdre le temps qu'il n'a pas.
 */
export function TicketListScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const locale = useLocale()
  const describe = useErrorMessage()

  const tickets = useTickets()

  if (tickets.isPending) {
    return (
      <Screen title={t('ticket.listTitle')}>
        <View style={sharedStyles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      </Screen>
    )
  }

  if (tickets.data === undefined) {
    return (
      <Screen title={t('ticket.listTitle')}>
        <View style={sharedStyles.centered}>
          <Text style={styles.message}>{describe(tickets.error)}</Text>
          <Button
            label={t('action.retry', { ns: 'common' })}
            onPress={() => void tickets.refetch()}
            variant="secondary"
          />
        </View>
      </Screen>
    )
  }

  const upcoming = tickets.data.filter((ticket) => ticket.status === 'VALID')
  const past = tickets.data.filter((ticket) => ticket.status !== 'VALID')

  const sections = [
    { key: 'upcoming', title: t('ticket.upcoming'), data: upcoming },
    { key: 'history', title: t('ticket.history'), data: past },
    // Une section vide n'a pas de titre à afficher : « Historique » suivi de
    // rien ressemble à un chargement qui n'a pas abouti.
  ].filter((section) => section.data.length > 0)

  return (
    <Screen title={t('ticket.listTitle')} subtitle={t('ticket.listSubtitle')}>
      <SectionList
        sections={sections}
        keyExtractor={(ticket) => ticket.reference}
        contentContainerStyle={styles.list}
        refreshing={tickets.isFetching}
        onRefresh={() => void tickets.refetch()}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={sharedStyles.centered}>
            <Text style={styles.message}>{t('ticket.empty')}</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TicketCard
            ticket={item}
            locale={locale}
            onPress={() => router.push(`/tickets/${item.reference}`)}
          />
        )}
      />
    </Screen>
  )
}

function TicketCard({
  ticket,
  locale,
  onPress,
}: {
  ticket: Ticket
  locale: ReturnType<typeof useLocale>
  onPress: () => void
}) {
  const { t } = useTranslation()
  const invalid = ticket.status !== 'VALID'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ticket.passenger_name}, ${ticket.trip.origin_station.city} → ${ticket.trip.destination_station.city}, ${ticketStatusLabels[locale][ticket.status]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
    >
      <View style={styles.head}>
        <View style={styles.agencyChip}>
          <Text style={styles.agencyLabel} numberOfLines={1}>
            {ticket.trip.agency.name}
          </Text>
        </View>

        <View style={[styles.statusChip, invalid ? styles.statusChipOff : null]}>
          <Text style={[styles.statusLabel, invalid ? styles.statusLabelOff : null]}>
            {ticketStatusLabels[locale][ticket.status]}
          </Text>
        </View>
      </View>

      {/*
        Les deux villes empilées et reliées, plutôt que « A → B » sur une ligne :
        c'est la même lecture que sur le billet, et les noms longs ne se font
        pas tronquer.
      */}
      <View style={styles.route}>
        <View style={styles.stop}>
          <RouteDot color={theme.route.origin} size={10} />
          <Text style={styles.city} numberOfLines={1}>
            {ticket.trip.origin_station.city}
          </Text>
        </View>
        <View style={styles.connector} />
        <View style={styles.stop}>
          <RouteDot color={theme.route.destination} size={10} />
          <Text style={styles.city} numberOfLines={1}>
            {ticket.trip.destination_station.city}
          </Text>
        </View>
      </View>

      <View style={styles.when}>
        <View style={styles.whenCell}>
          <CalendarIcon color={theme.text.muted} size={18} />
          <Text style={styles.whenLabel}>
            {formatDate(ticket.trip.departure_at, { locale })}
          </Text>
        </View>
        <View style={styles.whenCell}>
          <TimerIcon color={theme.text.muted} size={18} />
          <Text style={styles.whenLabel}>
            {formatTime(ticket.trip.departure_at, { locale })}
          </Text>
        </View>
      </View>

      <Text style={styles.passenger} numberOfLines={1}>
        {ticket.passenger_name}
        {ticket.seat_label === null || ticket.seat_label === undefined
          ? ''
          : ` · ${t('ticket.seat')} ${ticket.seat_label}`}
      </Text>

      {/*
        Faux bouton : la carte entière est déjà pressable, et deux cibles
        superposées annonceraient deux fois la même action.
      */}
      {invalid ? null : (
        <View style={styles.cta} importantForAccessibility="no-hide-descendants">
          <Text style={styles.ctaLabel}>{t('ticket.seeQr')}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...sharedStyles.sectionLabel,
    paddingTop: spacing.base,
    paddingBottom: spacing.xs,
  },
  card: {
    ...sharedStyles.card,
    gap: spacing.sm,
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
  agencyChip: {
    flex: 1,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: theme.surface.raised,
  },
  agencyLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: theme.text.secondary,
  },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: theme.surface.accent,
  },
  statusChipOff: {
    backgroundColor: theme.surface.inert,
  },
  statusLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: theme.text.accent,
  },
  statusLabelOff: {
    color: theme.text.secondary,
  },
  route: {
    gap: 2,
  },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  /** Le trait qui relie les deux pastilles, aligné sur leur centre. */
  connector: {
    width: 2,
    height: 14,
    marginLeft: 4,
    backgroundColor: theme.surface.border,
  },
  city: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  when: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radius.md,
    backgroundColor: theme.surface.raised,
  },
  whenCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  whenLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text.secondary,
  },
  passenger: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: theme.surface.brand,
  },
  ctaLabel: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.inverse,
  },
  message: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
})
