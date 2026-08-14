import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { fontSize, spacing, theme } from './theme'

export interface ScreenProps {
  children: ReactNode
  title?: string
  edges?: readonly Edge[]
}

/**
 * Cadre commun d'un écran.
 *
 * Il porte la zone sûre et le titre. Sans lui, chaque écran redéclare les
 * mêmes marges et l'un d'eux finit par passer sous l'encoche — le genre
 * d'écart qui ne se voit que sur l'appareil de quelqu'un d'autre.
 */
export function Screen({ children, title, edges = ['top'] }: ScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {title === undefined ? null : (
        <Text
          style={styles.title}
          // Le lecteur d'écran doit annoncer le titre en arrivant, pas le
          // premier champ du formulaire.
          accessibilityRole="header"
        >
          {title}
        </Text>
      )}
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.surface.page,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: theme.text.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  body: {
    flex: 1,
  },
})
