import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { formatMoney } from '@motoboy/shared'
import {
  Button,
  fontSize,
  lineHeight,
  radius,
  RouteDot,
  Screen,
  sharedStyles,
  spacing,
  TextField,
  theme,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useMakeOffer, useOpenRequests, type OpenRequest } from '../api/useDriverWork'

/**
 * La devise du pays.
 *
 * Ecrite ici parce qu'une offre n'a pas encore de course a laquelle emprunter la
 * sienne. Le reste de l'application lit celle que le serveur renvoie ; c'est le
 * seul montant que le telephone compose lui-meme.
 */
const CURRENCY = 'XAF'

/**
 * Les demandes de sa ville, et l'offre (C4, C5, C6).
 *
 * **Le détail et l'offre tiennent dans la liste.** Une demande porte cinq
 * informations — d'où, vers où, combien de personnes, la note, depuis quand ; les
 * pousser sur un écran séparé ferait naviguer pour lire ce qui tenait déjà à
 * l'écran, alors que le chauffeur compare plusieurs demandes.
 *
 * L'offre, elle, ouvre une feuille : c'est un engagement ferme sur un prix, et il
 * mérite un geste distinct de la lecture.
 */
export function OpenRequestsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const describe = useErrorMessage()

  const requests = useOpenRequests()
  const [offering, setOffering] = useState<OpenRequest | null>(null)

  const rows = requests.data?.data ?? []

  return (
    <Screen title={t('driver.openRequests')}>
      {requests.isPending ? (
        <View style={sharedStyles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      ) : requests.isError ? (
        <View style={sharedStyles.centered}>
          <Text style={styles.body}>{describe(requests.error)}</Text>
          <Button
            label={t('action.retry', { ns: 'common' })}
            variant="secondary"
            onPress={() => void requests.refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.reference}
          contentContainerStyle={styles.content}
          /*
           * Rafraîchissement au geste, pas au minuteur (C4). Le chauffeur ouvre
           * cet écran quand il cherche du travail ; interroger le serveur toutes
           * les dix secondes consommerait son forfait pendant qu'il conduit.
           */
          refreshControl={
            <RefreshControl
              refreshing={requests.isFetching}
              onRefresh={() => void requests.refetch()}
              tintColor={theme.text.brand}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('driver.openRequestsEmpty')}</Text>
              <Text style={styles.body}>{t('driver.openRequestsEmptyBody')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <RequestCard request={item} onOffer={() => setOffering(item)} />
          )}
        />
      )}

      {offering === null ? null : (
        <OfferSheet
          request={offering}
          onClose={() => setOffering(null)}
          onDone={() => {
            setOffering(null)
            router.push('/driver/rides')
          }}
        />
      )}
    </Screen>
  )
}

function RequestCard({
  request,
  onOffer,
}: {
  request: OpenRequest
  onOffer: () => void
}) {
  const { t } = useTranslation()

  return (
    <View style={styles.card}>
      <Leg
        color={theme.route.origin}
        city={request.origin.city}
        landmark={request.origin.landmark}
      />
      <View style={styles.connector} />
      <Leg
        color={theme.route.destination}
        city={request.destination.city}
        landmark={request.destination.landmark}
      />

      <View style={styles.meta}>
        <Text style={styles.metaText}>
          {t('driver.passengersCount', { count: request.passengers })}
        </Text>
      </View>

      {/*
        La note du passager est souvent la vraie information : trois bagages, un
        enfant, un détour. La tronquer ferait accepter une course qu'on refuserait
        en la lisant.
      */}
      {request.note === null || request.note === undefined || request.note === '' ? null : (
        <Text style={styles.note}>{request.note}</Text>
      )}

      <Button label={t('driver.offer')} onPress={onOffer} />
    </View>
  )
}

/** Un prix ferme et un délai annoncé. */
function OfferSheet({
  request,
  onClose,
  onDone,
}: {
  request: OpenRequest
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const describe = useErrorMessage()

  const [price, setPrice] = useState('')
  const [eta, setEta] = useState('')

  const offer = useMakeOffer(request.reference)

  const amount = Number.parseInt(price.replace(/\D/g, ''), 10)
  const minutes = Number.parseInt(eta.replace(/\D/g, ''), 10)
  const valid =
    Number.isFinite(amount) && amount >= 100 && Number.isFinite(minutes) && minutes >= 1

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />

      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{t('driver.offer')}</Text>

        <TextField
          label={t('driver.offerPrice')}
          hint={t('driver.offerPriceHint')}
          value={price}
          onChangeText={setPrice}
          keyboardType="number-pad"
          maxLength={9}
        />

        {/* Le montant relu en clair : un zéro de trop se voit ici, pas dans le champ. */}
        {valid ? (
          <Text style={styles.readback}>
            {formatMoney({ amount, currency: CURRENCY }, locale)}
          </Text>
        ) : null}

        <TextField
          label={t('driver.offerEta')}
          hint={t('driver.offerEtaHint')}
          value={eta}
          onChangeText={setEta}
          keyboardType="number-pad"
          maxLength={3}
        />

        {offer.error ? <Text style={styles.error}>{describe(offer.error)}</Text> : null}

        <Button
          label={t('driver.offerSubmit')}
          disabled={!valid}
          busy={offer.isPending}
          onPress={() =>
            offer.mutate({ price: amount, etaMinutes: minutes }, { onSuccess: onDone })
          }
        />
      </View>
    </Modal>
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

const styles = StyleSheet.create({
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
    height: 12,
    marginLeft: 4,
    backgroundColor: theme.surface.border,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metaText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text.secondary,
  },
  note: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.text.primary,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: theme.surface.raised,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.base,
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.surface.scrim,
  },
  sheet: {
    gap: spacing.base,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: theme.surface.card,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  readback: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.brand,
    textAlign: 'center',
  },
  error: {
    fontSize: fontSize.sm,
    color: theme.text.danger,
  },
})
