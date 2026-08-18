import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { formatMoney } from '@motoboy/shared'
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
  TimerIcon,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import {
  useAcceptOffer,
  useCancelServiceCall,
  usePayForRide,
  useReportNoShow,
  useServiceCall,
} from '../api/useServiceCall'

/** Les deux opérateurs Mobile Money du pays. */
const OPERATORS = ['MTN', 'ORANGE'] as const

/**
 * Suivre sa demande, comparer les offres, retenir la bonne (E1).
 *
 * **C'est la promesse du produit appliquée à un autre inventaire.** MOTOBOY
 * compare des agences pour un départ programmé ; ici il compare des offres de
 * chauffeurs, prix et délai côte à côte, et le passager tranche.
 *
 * Aucune fenêtre d'attente imposée (E4 bis) : chaque offre est retenable dès son
 * arrivée. Faire patienter quelqu'un qui a déjà ce qu'il lui faut ne lui rend pas
 * service, et la demande expire de toute façon.
 */
export function ServiceCallStatusScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const locale = useLocale()
  const describe = useErrorMessage()

  const reference = useLocalSearchParams<{ reference: string }>().reference ?? ''

  const call = useServiceCall(reference)
  const accept = useAcceptOffer(reference)
  const cancel = useCancelServiceCall(reference)

  const ride = call.data?.ride ?? null
  const pay = usePayForRide(reference, ride?.reference ?? '')
  const noShow = useReportNoShow(reference, ride?.reference ?? '')

  if (call.isPending) {
    return (
      <Screen title={t('serviceCall.title')}>
        <View style={styles.skeleton}>
          <SkeletonList count={2} variant="card" />
        </View>
      </Screen>
    )
  }

  if (call.data === undefined) {
    return (
      <Screen title={t('serviceCall.title')}>
        <View style={sharedStyles.centered}>
          <Text style={styles.body}>{describe(call.error)}</Text>
          <Button
            label={t('action.retry', { ns: 'common' })}
            onPress={() => void call.refetch()}
            variant="secondary"
          />
        </View>
      </Screen>
    )
  }

  const data = call.data
  const offers = data.offers ?? []
  const waiting = data.status === 'OPEN' || data.status === 'OFFERED'
  const paid = ride?.paid === true

  return (
    <Screen title={t('serviceCall.title')}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Le trajet demandé reste sous les yeux, quel que soit l'état. */}
        <View style={styles.card}>
          <Leg
            color={theme.route.origin}
            city={data.origin.city}
            landmark={data.origin.landmark}
          />
          <View style={styles.connector} />
          <Leg
            color={theme.route.destination}
            city={data.destination.city}
            landmark={data.destination.landmark}
          />
        </View>

        {data.status === 'EXPIRED' ? (
          <Notice
            title={t('serviceCall.expired')}
            body={t('serviceCall.expiredBody')}
            tone="warn"
          />
        ) : null}

        {data.status === 'CANCELLED' ? (
          <Notice title={t('serviceCall.cancelled')} tone="warn" />
        ) : null}

        {waiting && offers.length === 0 ? (
          <View style={styles.waiting}>
            <ActivityIndicator color={theme.text.brand} />
            <Text style={styles.waitingTitle}>{t('serviceCall.waiting')}</Text>
            <Text style={styles.body}>{t('serviceCall.waitingBody')}</Text>
          </View>
        ) : null}

        {/*
          Les offres disparaissent dès qu'une est retenue : le chauffeur choisi
          devient la seule information utile, et laisser les autres à l'écran
          ferait croire qu'on peut encore changer.
        */}
        {ride === null && offers.length > 0 ? (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('serviceCall.offers')}</Text>

            {offers.map((offer) => (
              <View key={offer.id} style={styles.offer}>
                <View style={styles.offerHead}>
                  <Text style={styles.offerPrice}>{formatMoney(offer.price, locale)}</Text>
                  <View style={styles.eta}>
                    <TimerIcon color={theme.text.muted} size={16} />
                    <Text style={styles.etaLabel}>
                      {t('serviceCall.eta', { minutes: offer.eta_minutes })}
                    </Text>
                  </View>
                </View>

                {/*
                  Le prénom et le véhicule, jamais le téléphone : les
                  coordonnées ne s'échangent qu'une fois l'offre retenue et
                  payée.
                */}
                <Text style={styles.offerDriver}>
                  {[
                    offer.driver.first_name,
                    offer.driver.vehicle_model,
                    offer.driver.vehicle_plate,
                  ]
                    .filter((part) => part !== null && part !== undefined && part !== '')
                    .join(' · ')}
                </Text>

                <Button
                  label={t('serviceCall.accept')}
                  onPress={() => accept.mutate(offer.id)}
                  busy={accept.isPending}
                />
              </View>
            ))}

            {accept.error ? (
              <Text style={styles.error}>{describe(accept.error)}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Chauffeur retenu. */}
        {ride === null ? null : (
          <View style={styles.card}>
            <View style={styles.matchedHead}>
              {paid ? (
                <View style={styles.seal}>
                  <CheckIcon color={theme.text.inverse} size={18} />
                </View>
              ) : null}
              <Text style={styles.matchedTitle}>
                {paid ? t('serviceCall.paid') : t('serviceCall.matched')}
              </Text>
            </View>

            {paid ? null : <Text style={styles.body}>{t('serviceCall.matchedBody')}</Text>}

            <Row
              label={t('serviceCall.driver')}
              value={[ride.driver.first_name, ride.driver.last_name]
                .filter((part) => part !== null && part !== undefined)
                .join(' ')}
            />
            {/*
              Le téléphone n'apparaît qu'une fois payé : c'est ce que le passager
              achète, et le livrer avant laisserait s'arranger hors plateforme —
              donc sans commission et sans recours.
            */}
            {paid ? (
              <Row label={t('account.phone')} value={ride.driver.phone ?? '—'} />
            ) : null}
            <Row
              label={t('serviceCall.plate')}
              value={ride.driver.vehicle_plate ?? '—'}
            />
            <Row
              label={t('serviceCall.meetAt')}
              value={data.origin.landmark ?? data.origin.city ?? '—'}
            />
            <Row label={t('payment.total')} value={formatMoney(ride.price, locale)} />
          </View>
        )}

        {ride !== null && !paid ? (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('payment.operator')}</Text>
            <View style={styles.operators}>
              {OPERATORS.map((operator) => (
                <Button
                  key={operator}
                  style={styles.operator}
                  label={operator}
                  variant="secondary"
                  onPress={() => pay.mutate(operator)}
                  busy={pay.isPending}
                />
              ))}
            </View>
            {/*
              Rien n'est encaissé de façon synchrone : le passager reçoit une
              sollicitation sur son téléphone et doit y saisir son code. L'écran
              attend, en le disant.
            */}
            {pay.data === undefined ? null : (
              <Text style={styles.body}>{t('serviceCall.paying')}</Text>
            )}
            {pay.error ? <Text style={styles.error}>{describe(pay.error)}</Text> : null}
          </View>
        ) : null}

        {/*
          L'absence ne se signale que sur une course payée et pas encore
          démarrée : avant paiement il n'y a rien à rembourser, et une fois
          partie, le chauffeur est venu.
        */}
        {paid && ride?.status === 'MATCHED' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('serviceCall.noShow')}
            onPress={() => noShow.mutate()}
            disabled={noShow.isPending}
            style={styles.link}
          >
            <Text style={styles.linkLabel}>{t('serviceCall.noShow')}</Text>
            <Text style={styles.linkHint}>{t('serviceCall.noShowConfirm')}</Text>
          </Pressable>
        ) : null}

        {ride?.status === 'IN_PROGRESS' ? (
          <Notice title={t('serviceCall.inProgress')} tone="ok" />
        ) : null}
        {ride?.status === 'COMPLETED' ? (
          <Notice title={t('serviceCall.completed')} tone="ok" />
        ) : null}

        {/* Annuler reste possible tant qu'aucun argent n'a bougé. */}
        {(waiting || ride?.status === 'MATCHED') && !paid ? (
          <Button
            label={t('serviceCall.cancel')}
            variant="ghost"
            onPress={() => cancel.mutate()}
            busy={cancel.isPending}
          />
        ) : null}

        {data.status === 'EXPIRED' || data.status === 'CANCELLED' ? (
          <Button
            label={t('serviceCall.entry')}
            onPress={() => router.replace('/service-call')}
          />
        ) : null}
      </ScrollView>
    </Screen>
  )
}

function Leg({
  color,
  city,
  landmark,
}: {
  color: string
  city?: string | null
  landmark?: string | null
}) {
  return (
    <View style={styles.leg}>
      <RouteDot color={color} size={10} />
      <View style={styles.legText}>
        <Text style={styles.legCity}>{city ?? '—'}</Text>
        {landmark === null || landmark === undefined || landmark === '' ? null : (
          <Text style={styles.legLandmark}>{landmark}</Text>
        )}
      </View>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

function Notice({
  title,
  body,
  tone,
}: {
  title: string
  body?: string
  tone: 'ok' | 'warn'
}) {
  return (
    <View style={[styles.notice, tone === 'ok' ? styles.noticeOk : styles.noticeWarn]}>
      <Text style={[styles.noticeTitle, tone === 'ok' ? styles.noticeTitleOk : null]}>
        {title}
      </Text>
      {body === undefined ? null : <Text style={styles.body}>{body}</Text>}
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
    gap: spacing.sm,
  },
  card: {
    ...sharedStyles.card,
    gap: spacing.base,
    padding: spacing.md,
  },
  leg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legText: {
    flex: 1,
    gap: 1,
  },
  legCity: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  legLandmark: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  connector: {
    width: 2,
    height: 14,
    marginLeft: 4,
    backgroundColor: theme.surface.border,
  },
  waiting: {
    ...sharedStyles.card,
    alignItems: 'center',
    gap: spacing.base,
    padding: spacing.lg,
  },
  waitingTitle: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  group: {
    gap: spacing.base,
  },
  groupTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  offer: {
    ...sharedStyles.card,
    gap: spacing.base,
    padding: spacing.md,
  },
  offerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  offerPrice: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.brand,
  },
  eta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  etaLabel: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  offerDriver: {
    fontSize: fontSize.sm,
    color: theme.text.secondary,
  },
  matchedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  seal: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.success,
  },
  matchedTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  rowLabel: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  rowValue: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.primary,
    textAlign: 'right',
  },
  operators: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  operator: {
    flex: 1,
  },
  notice: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  noticeOk: {
    backgroundColor: theme.surface.successSoft,
  },
  noticeWarn: {
    backgroundColor: theme.surface.dangerSoft,
  },
  noticeTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.onDangerSoft,
  },
  noticeTitleOk: {
    color: theme.text.success,
  },
  link: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
  },
  linkLabel: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.danger,
  },
  linkHint: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  error: {
    fontSize: fontSize.sm,
    color: theme.text.danger,
  },
})
