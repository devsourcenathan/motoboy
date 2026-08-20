import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { formatDate, formatTime, ticketStatusLabels } from '@motoboy/shared'
import {
  Button,
  CheckIcon,
  fontSize,
  lineHeight,
  radius,
  RouteDot,
  Screen,
  sharedStyles,
  SkeletonList,
  spacing,
  theme,
} from '../../../shared/ui'
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
 *
 * La carte reprend la découpe de la maquette, perforation comprise : le QR en
 * haut, encadré de bleu pour qu'on le trouve d'un coup d'œil sur un quai, puis
 * les informations que le contrôleur lit à voix haute.
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
        <View style={styles.skeleton}>
          <SkeletonList count={2} variant="card" />
        </View>
      </Screen>
    )
  }

  if (ticket.data === undefined) {
    return (
      <Screen title={t('ticket.title')}>
        <View style={sharedStyles.centered}>
          <Text style={styles.message}>{describe(ticket.error)}</Text>
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
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {invalid ? (
          <View style={styles.warning} accessibilityRole="alert">
            <Text style={styles.warningText}>
              {data.status === 'CANCELLED' ? t('ticket.cancelled') : t('ticket.used')}
            </Text>
            <Text style={styles.warningHint}>
              {ticketStatusLabels[locale][data.status]}
            </Text>
          </View>
        ) : (
          <View style={styles.hero}>
            <View style={styles.seal}>
              <CheckIcon color={theme.text.inverse} size={30} />
            </View>
            <Text style={styles.heroTitle} accessibilityRole="header">
              {t('ticket.confirmed')}
            </Text>
            <Text style={styles.heroBody}>{t('ticket.showAtBoarding')}</Text>
          </View>
        )}

        <View style={styles.card}>
          {/*
            Bandeau marine et villes en capitales espacées : c'est ce qui fait
            reconnaître un billet à un mètre, quand un contrôleur passe dans
            l'allée et ne lit rien d'autre.
          */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardWordmark}>MOTOBOY</Text>
            <View style={styles.cardRoute}>
              <Text style={styles.cardCity} numberOfLines={1}>
                {data.trip.origin_station.city.toUpperCase()}
              </Text>
              <Text style={styles.cardArrow}>→</Text>
              <Text style={styles.cardCity} numberOfLines={1}>
                {data.trip.destination_station.city.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.who}>
            <View style={styles.headerCell}>
              <Text style={styles.headerLabel}>{t('ticket.agency')}</Text>
              <Text style={styles.headerValue} numberOfLines={1}>
                {data.trip.agency.name}
              </Text>
            </View>
            <View style={[styles.headerCell, styles.headerCellRight]}>
              <Text style={styles.headerLabel}>{t('ticket.passenger')}</Text>
              <Text style={styles.headerValue} numberOfLines={1}>
                {data.passenger_name}
              </Text>
            </View>
          </View>

          <View style={styles.qrZone}>
            <View style={[styles.qrFrame, invalid ? styles.qrFrameDimmed : null]}>
              <TicketQr payload={data.qr_payload} dimmed={invalid} />
            </View>
            <Text style={styles.reference}>
              {t('ticket.reference')} · {data.reference}
            </Text>
          </View>

          {/*
            La perforation : deux encoches qui mordent sur les bords et un trait
            tireté entre elles. C'est ce qui fait lire l'objet comme un billet
            plutôt que comme une fiche.
          */}
          <View style={styles.perforation}>
            <View style={[styles.notch, styles.notchLeft]} />
            <View style={styles.dashes} />
            <View style={[styles.notch, styles.notchRight]} />
          </View>

          <View style={styles.body}>
            <View style={styles.ends}>
              <View style={styles.end}>
                <Text style={styles.endLabel}>{t('ticket.origin')}</Text>
                <View style={styles.endName}>
                  <RouteDot color={theme.route.origin} size={10} />
                  <Text style={styles.city} numberOfLines={1}>
                    {data.trip.origin_station.city}
                  </Text>
                </View>
                <Text style={styles.station} numberOfLines={1}>
                  {data.trip.origin_station.name}
                </Text>
              </View>

              <View style={[styles.end, styles.endRight]}>
                <Text style={styles.endLabel}>{t('ticket.destination')}</Text>
                <View style={styles.endName}>
                  <Text style={styles.city} numberOfLines={1}>
                    {data.trip.destination_station.city}
                  </Text>
                  <RouteDot color={theme.route.destination} size={10} />
                </View>
                <Text style={[styles.station, styles.stationRight]} numberOfLines={1}>
                  {data.trip.destination_station.name}
                </Text>
              </View>
            </View>

            <View style={styles.rule} />

            <View style={styles.ends}>
              <Detail
                label={t('ticket.date')}
                value={formatDate(data.trip.departure_at, { locale })}
              />
              <Detail
                label={t('ticket.time')}
                value={formatTime(data.trip.departure_at, { locale })}
                align="right"
              />
            </View>

            <View style={styles.rule} />

            <View style={styles.seatRow}>
              <Text style={styles.endLabel}>{t('ticket.seat')}</Text>
              <Text style={styles.seat}>{data.seat_label ?? t('ticket.noSeat')}</Text>
            </View>
          </View>
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

function Detail({
  label,
  value,
  align = 'left',
}: {
  label: string
  value: string
  align?: 'left' | 'right'
}) {
  return (
    <View style={[styles.end, align === 'right' ? styles.endRight : null]}>
      <Text style={styles.endLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  /* L'enveloppe des squelettes : même gouttière que le contenu réel. */
  skeleton: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.base,
    paddingTop: spacing.base,
  },
  seal: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.brand,
  },
  heroTitle: {
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight['2xl'],
    fontWeight: '700',
    letterSpacing: -0.5,
    color: theme.text.primary,
    textAlign: 'center',
  },
  heroBody: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  warning: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: theme.surface.dangerSoft,
  },
  warningText: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.onDangerSoft,
    textAlign: 'center',
  },
  warningHint: {
    fontSize: fontSize.sm,
    color: theme.text.onDangerSoft,
    textAlign: 'center',
  },
  card: {
    ...sharedStyles.card,
    overflow: 'hidden',
  },
  cardHeader: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: theme.surface.ink,
  },
  cardWordmark: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: theme.text.inverse,
  },
  cardRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardCity: {
    flexShrink: 1,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    letterSpacing: 2,
    color: theme.text.inverse,
  },
  cardArrow: {
    fontSize: fontSize.base,
    color: theme.text.inverse,
    opacity: 0.7,
  },
  who: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: theme.surface.raised,
  },
  headerCell: {
    flex: 1,
    gap: 1,
  },
  headerCellRight: {
    alignItems: 'flex-end',
  },
  headerLabel: {
    ...sharedStyles.sectionLabel,
    color: theme.text.muted,
  },
  headerValue: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  qrZone: {
    alignItems: 'center',
    gap: spacing.base,
    padding: spacing.md,
  },
  qrFrame: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: theme.surface.brand,
    backgroundColor: theme.surface.card,
  },
  qrFrameDimmed: {
    borderColor: theme.surface.border,
  },
  reference: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
  perforation: {
    height: 20,
    justifyContent: 'center',
  },
  notch: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: theme.surface.page,
  },
  notchLeft: {
    left: -10,
  },
  notchRight: {
    right: -10,
  },
  dashes: {
    marginHorizontal: spacing.md,
    borderBottomWidth: 2,
    borderStyle: 'dashed',
    borderBottomColor: theme.surface.border,
  },
  body: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  ends: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  end: {
    flex: 1,
    gap: 2,
  },
  endRight: {
    alignItems: 'flex-end',
  },
  endLabel: {
    ...sharedStyles.sectionLabel,
    color: theme.text.muted,
  },
  endName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  city: {
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
  detailValue: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  rule: {
    height: 1,
    backgroundColor: theme.surface.border,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seat: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.brand,
  },
  offline: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
})
