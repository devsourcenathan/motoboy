import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { formatDateTime, ticketStatusLabels } from '@motoboy/shared'
import type { Ticket } from '@motoboy/api-client/types'
import {
  Button,
  fontSize,
  radius,
  Screen,
  spacing,
  theme,
  TOUCH_TARGET,
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
        <View style={styles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      </Screen>
    )
  }

  if (tickets.data === undefined) {
    return (
      <Screen title={t('ticket.listTitle')}>
        <View style={styles.centered}>
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

  return (
    <Screen title={t('ticket.listTitle')}>
      <FlatList
        data={tickets.data}
        keyExtractor={(ticket) => ticket.reference}
        contentContainerStyle={styles.list}
        refreshing={tickets.isFetching}
        onRefresh={() => void tickets.refetch()}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.message}>{t('ticket.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TicketRow
            ticket={item}
            locale={locale}
            onPress={() => router.push(`/tickets/${item.reference}`)}
          />
        )}
      />
    </Screen>
  )
}

function TicketRow({
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
      accessibilityLabel={`${ticket.passenger_name}, ${ticket.trip.origin_station.city} → ${ticket.trip.destination_station.city}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.rowPressed : null,
        invalid ? styles.rowInvalid : null,
      ]}
    >
      <Text style={styles.route}>
        {ticket.trip.origin_station.city} → {ticket.trip.destination_station.city}
      </Text>
      <Text style={styles.when}>
        {formatDateTime(ticket.trip.departure_at, { locale })}
      </Text>
      <Text style={styles.meta}>
        {ticket.passenger_name}
        {ticket.seat_label === null || ticket.seat_label === undefined
          ? ''
          : ` · ${t('ticket.seat')} ${ticket.seat_label}`}
      </Text>
      {invalid ? (
        <Text style={styles.status}>{ticketStatusLabels[locale][ticket.status]}</Text>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  row: {
    minHeight: TOUCH_TARGET,
    gap: spacing.xs / 2,
    padding: spacing.md,
    backgroundColor: theme.surface.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowInvalid: {
    opacity: 0.6,
  },
  route: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  when: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
  },
  meta: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  status: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text.danger,
  },
  message: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
})
