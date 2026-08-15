import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SUPPORTED_LOCALES, type Locale } from '@motoboy/shared'
import {
  CheckIcon,
  fontSize,
  lineHeight,
  radius,
  Screen,
  sharedStyles,
  spacing,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { chooseLanguage } from '../../../shared/i18n/language'
import { useSignOut } from '../api/useAuth'

/**
 * Les réglages.
 *
 * **Seulement ce qui agit.** La maquette en montre onze ; neuf n'ont rien
 * derrière — sécurité et mot de passe (le compte n'en a pas, l'OTP en tient
 * lieu), confidentialité, centre d'aide, nous contacter, thème (aucun mode
 * sombre n'existe), et les entrées du profil qui demandent des endpoints
 * absents. Une ligne qui mène nulle part fait un écran qui paraît fini sans
 * l'être, et c'est le passager qui découvre la différence.
 */
export function SettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const locale = useLocale()
  const signOut = useSignOut()

  return (
    <Screen title={t('account.settings')}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>{t('account.sectionPreferences')}</Text>

        <View style={styles.card}>
          {/*
            Le choix est **appliqué et retenu**, contrairement à ce que cet
            écran affichait avant : il survit à la fermeture.
          */}
          {SUPPORTED_LOCALES.map((option: Locale) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: locale === option }}
              onPress={() => void chooseLanguage(option)}
              style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
            >
              <Text style={styles.rowTitle}>
                {option === 'fr' ? t('account.languageFr') : t('account.languageEn')}
              </Text>
              {locale === option ? (
                <CheckIcon color={theme.text.brand} size={20} />
              ) : null}
            </Pressable>
          ))}
        </View>

        {/*
          La devise ne se règle pas : les prix viennent du serveur en XAF, et
          proposer un choix laisserait croire à une conversion qui n'existe pas.
        */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{t('account.currency')}</Text>
            <Text style={styles.rowValue}>XAF</Text>
          </View>
        </View>

        <Text style={styles.section}>{t('account.sectionSupport')}</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{t('account.about')}</Text>
            <Text style={styles.rowValue}>
              v{Constants.expoConfig?.version ?? '—'}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: signOut.isPending }}
          disabled={signOut.isPending}
          onPress={() =>
            signOut.mutate(undefined, {
              // La déconnexion vide la session : rester sur un écran de compte
              // afficherait le profil de personne.
              onSuccess: () => router.replace('/account'),
            })
          }
          style={({ pressed }) => [styles.signOut, pressed ? styles.rowPressed : null]}
        >
          <Text style={styles.signOutLabel}>{t('account.signOut')}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.base,
  },
  section: {
    ...sharedStyles.sectionLabel,
    marginTop: spacing.base,
  },
  card: {
    ...sharedStyles.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.base,
  },
  rowPressed: {
    backgroundColor: theme.surface.raised,
  },
  rowTitle: {
    flex: 1,
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.primary,
  },
  rowValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.muted,
  },
  signOut: {
    ...sharedStyles.card,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    borderRadius: radius.lg,
  },
  signOutLabel: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.danger,
  },
})
