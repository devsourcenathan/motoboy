import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { formatDateTime, ticketStatusLabels } from '@motoboy/shared'
import { Button, fontSize, radius, Screen, spacing, theme } from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useTicket } from '../api/useTickets'
import { TicketQr } from './TicketQr'

/**
 * Le billet.
 *
 * **Il doit s'ouvrir sans réseau.** Le produit s'utilise en gare routière, où la
 * couverture n'est pas garantie : le billet est mis en cache sur le disque, et
 * le QR se **regénère à partir des données stockées** plutôt que de se
 * télécharger comme image. Un billet dont le code ne s'affiche pas en gare ne
 * vaut rien (I5).
 */
export function TicketScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const locale = useLocale()
  const describe = useErrorMessage()

  const reference = useLocalSearchParams<{ reference: string }>().reference ?? ''
  const ticket = useTicket(reference)

  // Le cache répond avant le réseau : on n'affiche un chargement que la
  // première fois, quand il n'y a rien à montrer.
  if (ticket.isPending) {
    return (
      <Screen title={t('ticket.title')}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      </Screen>
    )
  }

  if (ticket.data === undefined) {
    return (
      <Screen title={t('ticket.title')}>
        <View style={styles.centered}>
          <Text style={styles.error}>{describe(ticket.error)}</Text>
          <Button
            label={t('action.retry', { ns: 'common' })}
            onPress={() => void ticket.refetch()}
            variant="secondary"
          />
        </View>
      </Screen>
    )
  }

  const data = ticket.data
  const invalid = data.status !== 'VALID'

  return (
    <Screen title={t('ticket.title')}>
      <ScrollView contentContainerStyle={styles.content}>
        {invalid ? (
          <View style={styles.warning} accessibilityRole="alert">
            <Text style={styles.warningText}>
              {data.status === 'CANCELLED' ? t('ticket.cancelled') : t('ticket.used')}
            </Text>
          </View>
        ) : null}

        <TicketQr payload={data.qr_payload} dimmed={invalid} />

        <Text style={styles.hint}>
          {invalid ? ticketStatusLabels[locale][data.status] : t('ticket.showAtBoarding')}
        </Text>

        <View style={styles.card}>
          <Row label={t('ticket.passenger')} value={data.passenger_name} />
          <Row label={t('ticket.seat')} value={data.seat_label ?? t('ticket.noSeat')} />
          <Row
            label={t('ticket.departure')}
            value={formatDateTime(data.trip.departure_at, { locale })}
          />
          <Row
            label={t('search.from')}
            value={`${data.trip.origin_station.city} · ${data.trip.origin_station.name}`}
          />
          <Row label={t('search.to')} value={data.trip.destination_station.city} />
          <Row label={t('ticket.reference')} value={data.reference} />
        </View>

        <Text style={styles.offline}>{t('ticket.offline')}</Text>

        {/*
          L'annulation part du billet : c'est là qu'un passager y pense, et
          c'est là qu'il a sous les yeux ce qu'il s'apprête à perdre. Un billet
          déjà annulé ou utilisé n'a plus rien à annuler.
        */}
        {invalid ? null : (
          <Button
            label={t('cancellation.title')}
            variant="ghost"
            onPress={() => router.push(`/bookings/${data.booking_reference}/cancel`)}
          />
        )}
      </ScrollView>
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
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
  warning: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: theme.surface.raised,
  },
  warningText: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.danger,
    textAlign: 'center',
  },
  hint: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: theme.surface.raised,
    borderRadius: radius.lg,
  },
  row: {
    gap: spacing.xs / 2,
  },
  rowLabel: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
    textTransform: 'uppercase',
  },
  rowValue: {
    fontSize: fontSize.base,
    color: theme.text.primary,
    fontWeight: '600',
  },
  offline: {
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
