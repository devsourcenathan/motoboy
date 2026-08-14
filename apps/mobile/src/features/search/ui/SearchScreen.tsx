import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { fontSize, spacing, theme } from '../../../shared/ui'

/**
 * Recherche — écran d'accueil du passager.
 *
 * Provisoire : la saisie des villes et de la date arrive avec l'autocomplétion,
 * qui tape le référentiel fermé de l'API. Cet écran existe déjà pour que
 * l'aiguillage d'entrée et l'onboarding aient une destination réelle.
 */
export function SearchScreen() {
  const { t } = useTranslation()

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('search.title')}</Text>
        <Text style={styles.hint}>{t('state.empty', { ns: 'common' })}</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.surface.page,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: theme.text.primary,
  },
  hint: {
    fontSize: fontSize.base,
    color: theme.text.muted,
  },
})
