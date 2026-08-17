import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  Button,
  CheckIcon,
  fontSize,
  lineHeight,
  radius,
  Screen,
  sharedStyles,
  spacing,
  theme,
} from '../../../shared/ui'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useDriverProfile, type DriverProfile } from '../api/useDriver'
import { DocumentDeposit } from './DocumentDeposit'
import { missingDocuments } from '../model/driverApplication'

/**
 * Devenir chauffeur, puis savoir où en est son dossier (C1, C2, C3).
 *
 * **Un seul écran pour la candidature et son suivi.** Ce sont deux moments de la
 * même chose, et un chauffeur refusé a besoin de lire le motif et de corriger au
 * même endroit. Les séparer l'obligerait à chercher où se trouve la mauvaise
 * nouvelle.
 */
export function DriverHomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const describe = useErrorMessage()

  const profile = useDriverProfile()

  if (profile.isPending) {
    return (
      <Screen title={t('driver.title')}>
        <View style={sharedStyles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      </Screen>
    )
  }

  if (profile.isError) {
    return (
      <Screen title={t('driver.title')}>
        <View style={sharedStyles.centered}>
          <Text style={styles.body}>{describe(profile.error)}</Text>
          <Button
            label={t('action.retry', { ns: 'common' })}
            variant="secondary"
            onPress={() => void profile.refetch()}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title={t('driver.title')}>
      <ScrollView contentContainerStyle={styles.content}>
        {profile.data === null ? (
          <Pitch onStart={() => router.push('/driver/apply')} />
        ) : (
          <Dossier
            profile={profile.data}
            onFix={() => router.push('/driver/apply')}
            onWork={() => router.push('/driver/requests')}
            onEarnings={() => router.push('/driver/earnings')}
          />
        )}
      </ScrollView>
    </Screen>
  )
}

/** Ce que ça demande, avant de commencer. */
function Pitch({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation()

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>{t('driver.pitchTitle')}</Text>
        <Text style={styles.body}>{t('driver.pitchBody')}</Text>
      </View>

      {/*
        Les quatre pièces annoncées **avant** le formulaire : les découvrir à
        l'étape du dépôt ferait abandonner quelqu'un qui n'a pas ses papiers sur
        lui, après avoir tout saisi.
      */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('driver.requires')}</Text>
        <Requirement label={t('driver.requiresLicence')} />
        <Requirement label={t('driver.requiresRegistration')} />
        <Requirement label={t('driver.requiresIdentity')} />
        <Requirement label={t('driver.requiresInsurance')} />
      </View>

      <Button label={t('driver.start')} onPress={onStart} />
    </>
  )
}

function Dossier({
  profile,
  onFix,
  onWork,
  onEarnings,
}: {
  profile: DriverProfile
  onFix: () => void
  onWork: () => void
  onEarnings: () => void
}) {
  const { t } = useTranslation()

  const missing = missingDocuments(profile.documents)

  const headline = {
    PENDING: t('driver.statusPending'),
    APPROVED: t('driver.statusApproved'),
    REJECTED: t('driver.statusRejected'),
    SUSPENDED: t('driver.statusSuspended'),
  }[profile.status]

  const tone = profile.status === 'APPROVED' ? 'ok' : profile.status === 'PENDING' ? 'wait' : 'bad'

  return (
    <>
      <View
        style={[
          styles.banner,
          tone === 'ok' ? styles.bannerOk : null,
          tone === 'bad' ? styles.bannerBad : null,
        ]}
      >
        <View style={styles.bannerHead}>
          {tone === 'ok' ? <CheckIcon color={theme.text.success} size={20} /> : null}
          <Text style={styles.bannerTitle}>{headline}</Text>
        </View>

        {profile.status === 'PENDING' ? (
          <Text style={styles.body}>{t('driver.statusPendingBody')}</Text>
        ) : null}
        {profile.status === 'APPROVED' ? (
          <Text style={styles.body}>{t('driver.statusApprovedBody')}</Text>
        ) : null}

        {/*
          Le motif est la seule information qui rend un refus actionnable. Le
          contrat le rend lisible par le chauffeur ; le taire ici reviendrait à
          ne pas l'avoir demandé.
        */}
        {profile.review_note === null || profile.review_note === undefined ? null : (
          <View style={styles.note}>
            <Text style={styles.noteLabel}>{t('driver.reviewNote')}</Text>
            <Text style={styles.noteBody}>{profile.review_note}</Text>
          </View>
        )}
      </View>

      {/*
        Validé mais permis périmé : `can_drive` est faux sans que le statut
        change. C'est le seul cas où le statut seul induirait en erreur.
      */}
      {profile.status === 'APPROVED' && !profile.can_drive ? (
        <View style={[styles.banner, styles.bannerBad]}>
          <Text style={styles.body}>{t('driver.licenceExpired')}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('driver.form.vehicle')}</Text>
        <Row label={t('driver.form.plate')} value={profile.vehicle_plate} />
        <Row label={t('driver.form.model')} value={profile.vehicle_model ?? '—'} />
        <Row label={t('driver.form.seats')} value={String(profile.vehicle_seats)} />
        <Row label={t('driver.form.licenceExpiry')} value={profile.license_expires_at} />
      </View>

      <DocumentDeposit provided={profile.documents} missing={missing} />

      {profile.can_drive ? (
        <Button label={t('driver.work')} onPress={onWork} />
      ) : null}

      {/*
        Ses revenus restent accessibles meme dossier suspendu : l'argent deja
        gagne lui est du, et le lui cacher serait le pire moment pour le faire.
      */}
      <Button label={t('driver.earnings')} variant="secondary" onPress={onEarnings} />

      {profile.status === 'REJECTED' || profile.status === 'SUSPENDED' ? (
        <Button label={t('driver.resubmit')} variant="secondary" onPress={onFix} />
      ) : null}
    </>
  )
}

function Requirement({ label }: { label: string }) {
  return (
    <View style={styles.requirement}>
      <View style={styles.bullet} />
      <Text style={styles.body}>{label}</Text>
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
  title: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.primary,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.secondary,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: theme.text.brand,
  },
  banner: {
    gap: spacing.base,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: theme.surface.raised,
  },
  bannerOk: {
    backgroundColor: theme.surface.successSoft,
  },
  bannerBad: {
    backgroundColor: theme.surface.dangerSoft,
  },
  bannerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  bannerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  note: {
    gap: 2,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: theme.surface.card,
  },
  noteLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: theme.text.muted,
    textTransform: 'uppercase',
  },
  noteBody: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
})
