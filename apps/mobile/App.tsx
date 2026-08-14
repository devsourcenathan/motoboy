import { StatusBar } from 'expo-status-bar'
import { getLocales } from 'expo-localization'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Locale } from '@motoboy/api-client/types'
import {
  bookingStatusLabels,
  colors,
  countdownTo,
  formatCountdown,
  formatDuration,
  formatMoney,
  LOCALE_NAMES,
  resolveLocale,
  spacing,
  SUPPORTED_LOCALES,
} from '@motoboy/shared'

/**
 * Écran de vérification de la chaîne.
 *
 * Il ne fait pas partie du produit : il prouve que les packages du workspace
 * traversent bien jusqu'à Metro, dans les deux langues. À remplacer par le vrai
 * routage.
 */
export default function App() {
  // La langue du téléphone sert de valeur initiale ; une fois le compte créé,
  // `users.locale` fait foi — c'est elle qui détermine la langue des SMS.
  const [locale, setLocale] = useState<Locale>(() =>
    resolveLocale(getLocales()[0]?.languageCode),
  )

  const hold = countdownTo(new Date(Date.now() + 9 * 60_000).toISOString())

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MOTOBOY</Text>

      <View style={styles.switcher}>
        {SUPPORTED_LOCALES.map((code) => (
          <Pressable key={code} onPress={() => setLocale(code)}>
            <Text style={code === locale ? styles.localeActive : styles.locale}>
              {LOCALE_NAMES[code]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text>{bookingStatusLabels[locale].PENDING_PAYMENT}</Text>
      <Text style={styles.countdown}>{formatCountdown(hold)}</Text>
      <Text>{formatMoney({ amount: 6500, currency: 'XAF' }, locale)}</Text>
      <Text>{formatDuration(150, locale)}</Text>

      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.brand[600],
  },
  switcher: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  locale: {
    color: colors.neutral[500],
  },
  localeActive: {
    color: colors.brand[600],
    fontWeight: '700',
  },
  countdown: {
    fontSize: 22,
    color: colors.status.held,
  },
})
