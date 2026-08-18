import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  CheckIcon,
  fontSize,
  lineHeight,
  PersonIcon,
  radius,
  spacing,
  TextField,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useUploadIdDocument } from '../api/useUploadIdDocument'

export interface IdDocumentFieldProps {
  mode: 'NUMBER' | 'IMAGE'
  required: boolean
  number: string
  path: string | null
  onChangeNumber: (value: string) => void
  onChangePath: (value: string | null) => void
}

/**
 * La pièce d'identité du voyageur principal.
 *
 * **Une seule des deux formes est demandée**, et c'est le serveur qui tranche —
 * afficher les deux laisserait le passager choisir ce que la plateforme n'accepte
 * pas, et deux sources pour une même identité feraient qu'on ne saurait laquelle
 * fait foi au contrôle.
 *
 * En mode photo, l'image part **tout de suite** et le formulaire ne garde que le
 * chemin. Attendre l'envoi de la réservation ferait courir le délai de tenue de
 * place pendant un téléversement — sur une 3G de gare, c'est la place perdue.
 */
export function IdDocumentField({
  mode,
  required,
  number,
  path,
  onChangeNumber,
  onChangePath,
}: IdDocumentFieldProps) {
  const { t } = useTranslation()
  const describe = useErrorMessage()
  const upload = useUploadIdDocument()
  const [denied, setDenied] = useState(false)

  async function pick() {
    setDenied(false)

    /*
     * La permission est demandée **au moment du geste**, pas au lancement : le
     * passager comprend pourquoi on veut sa galerie quand il vient d'appuyer sur
     * « ajouter la photo », et refuser reste sans conséquence ailleurs.
     */
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      setDenied(true)

      return
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Une pièce illisible fait refuser l'embarquement : la qualité compte plus
      // que le poids.
      quality: 0.8,
      allowsMultipleSelection: false,
    })

    if (picked.canceled) return

    const asset = picked.assets[0]

    if (asset === undefined) return

    const stored = await upload.mutateAsync(asset.uri)

    onChangePath(stored)
  }

  if (mode === 'NUMBER') {
    return (
      <View style={styles.block}>
        <TextField
          label={required ? t('booking.idNumber') : t('booking.idNumberOptional')}
          hint={t('booking.idNumberHint')}
          value={number}
          onChangeText={onChangeNumber}
          maxLength={50}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>
    )
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>
        {required ? t('booking.idPhoto') : t('booking.idPhotoOptional')}
      </Text>
      <Text style={styles.hint}>{t('booking.idPhotoHint')}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('booking.idPhoto')}
        accessibilityState={{ disabled: upload.isPending }}
        disabled={upload.isPending}
        onPress={() => void pick()}
        style={({ pressed }) => [
          styles.drop,
          path === null ? null : styles.dropDone,
          pressed ? styles.dropPressed : null,
        ]}
      >
        {upload.isPending ? (
          <ActivityIndicator color={theme.text.brand} />
        ) : path === null ? (
          <>
            <PersonIcon color={theme.text.brand} size={22} />
            <Text style={styles.dropLabel}>{t('booking.idPhotoAdd')}</Text>
          </>
        ) : (
          <>
            <CheckIcon color={theme.text.success} size={22} />
            {/*
              Le chemin n'est pas montré : il ne veut rien dire pour le passager,
              et l'afficher inviterait à croire qu'il faut le recopier quelque part.
            */}
            <Text style={styles.dropDoneLabel}>{t('booking.idPhotoDone')}</Text>
            <Text style={styles.dropReplace}>{t('booking.idPhotoReplace')}</Text>
          </>
        )}
      </Pressable>

      {denied ? <Text style={styles.error}>{t('booking.idPhotoDenied')}</Text> : null}
      {upload.error ? <Text style={styles.error}>{describe(upload.error)}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.text.muted,
  },
  hint: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
  drop: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: TOUCH_TARGET * 2,
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.surface.border,
    backgroundColor: theme.surface.raised,
  },
  dropDone: {
    borderStyle: 'solid',
    borderColor: theme.text.success,
    backgroundColor: theme.surface.successSoft,
  },
  dropPressed: {
    opacity: 0.7,
  },
  dropLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: theme.text.brand,
  },
  dropDoneLabel: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.success,
  },
  dropReplace: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
  error: {
    fontSize: fontSize.sm,
    color: theme.text.danger,
  },
})
