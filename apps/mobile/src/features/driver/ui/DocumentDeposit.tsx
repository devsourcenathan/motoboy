import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  CheckIcon,
  fontSize,
  lineHeight,
  radius,
  sharedStyles,
  spacing,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useUploadDocument } from '../api/useUploadDocument'
import { REQUIRED_DOCUMENTS, type DocumentType } from '../model/driverApplication'

/**
 * Les quatre pièces, déposées une par une (C2).
 *
 * **Chaque ligne dit son état.** Une barre de progression globale ne dirait pas
 * laquelle manque, et c'est la seule information qui permet d'agir. Redéposer une
 * pièce remplace la précédente, côté serveur : la ligne reste donc cliquable
 * même déposée, pour corriger une photo illisible.
 */
export function DocumentDeposit({
  provided,
  missing,
}: {
  provided: readonly string[]
  missing: readonly DocumentType[]
}) {
  const { t } = useTranslation()
  const describe = useErrorMessage()

  const upload = useUploadDocument()
  const [busy, setBusy] = useState<DocumentType | null>(null)

  const labels: Record<DocumentType, string> = {
    LICENSE: t('driver.requiresLicence'),
    REGISTRATION: t('driver.requiresRegistration'),
    IDENTITY: t('driver.requiresIdentity'),
    INSURANCE: t('driver.requiresInsurance'),
  }

  async function pick(type: DocumentType) {
    /*
     * L'autorisation se demande au moment du geste, pas au démarrage : un
     * chauffeur comprend pourquoi on veut sa galerie quand il vient d'appuyer
     * sur « déposer », et refuser reste sans conséquence sur le reste.
     */
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) return

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Une pièce d'identité illisible fait refuser le dossier : la qualité
      // compte plus que le poids, et une seule image par dépôt.
      quality: 0.8,
      allowsMultipleSelection: false,
    })

    if (picked.canceled) return

    const asset = picked.assets[0]

    if (asset === undefined) return

    setBusy(type)

    try {
      await upload.mutateAsync({
        type,
        file: {
          uri: asset.uri,
          name: asset.fileName ?? `${type.toLowerCase()}.jpg`,
          mimeType: asset.mimeType ?? 'image/jpeg',
        },
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {missing.length === 0 ? t('driver.documentsSent') : t('driver.missingDocuments')}
      </Text>

      {REQUIRED_DOCUMENTS.map((type) => {
        const done = provided.includes(type)

        return (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityLabel={`${labels[type]} — ${t('driver.upload')}`}
            accessibilityState={{ disabled: busy !== null }}
            disabled={busy !== null}
            onPress={() => void pick(type)}
            style={styles.line}
          >
            <View style={[styles.mark, done ? styles.markDone : null]}>
              {done ? <CheckIcon color={theme.text.inverse} size={14} /> : null}
            </View>

            <Text style={styles.label} numberOfLines={2}>
              {labels[type]}
            </Text>

            {busy === type ? (
              <ActivityIndicator color={theme.text.brand} size="small" />
            ) : (
              <Text style={styles.action}>{t('driver.upload')}</Text>
            )}
          </Pressable>
        )
      })}

      {upload.error ? <Text style={styles.error}>{describe(upload.error)}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    ...sharedStyles.card,
    gap: spacing.base,
    padding: spacing.md,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
  },
  mark: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: theme.surface.border,
    backgroundColor: theme.surface.inert,
  },
  markDone: {
    borderColor: 'transparent',
    backgroundColor: theme.surface.success,
  },
  label: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.text.primary,
  },
  action: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.brand,
  },
  error: {
    fontSize: fontSize.sm,
    color: theme.text.danger,
  },
})
