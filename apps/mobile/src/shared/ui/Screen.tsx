import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { BackIcon } from './Icons'
import { fontSize, lineHeight, spacing, theme, TOUCH_TARGET } from './theme'

export interface ScreenProps {
  children: ReactNode
  /** Grand titre de la page — « Mes Billets ». Absent sur les écrans de flux. */
  title?: string
  subtitle?: string
  /**
   * Barre de marque.
   *
   * Retirée sur l'onboarding, qui occupe l'écran entier et porte sa propre
   * identité.
   */
  chrome?: boolean
  edges?: readonly Edge[]
}

/**
 * Cadre commun d'un écran.
 *
 * Il porte la zone sûre, la barre de marque et le titre. Sans lui, chaque écran
 * redéclare les mêmes marges et l'un d'eux finit par passer sous l'encoche — le
 * genre d'écart qui ne se voit que sur l'appareil de quelqu'un d'autre.
 *
 * Le mot-symbole est **centré et présent partout**, comme sur les maquettes :
 * c'est le seul repère fixe d'un parcours où le passager arrive parfois
 * directement sur son billet depuis une notification.
 */
export function Screen({
  children,
  title,
  subtitle,
  chrome = true,
  edges = ['top'],
}: ScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {chrome ? <AppBar /> : null}

      {title === undefined ? null : (
        <View style={styles.heading}>
          <Text
            style={styles.title}
            // Le lecteur d'écran doit annoncer le titre en arrivant, pas le
            // premier champ du formulaire.
            accessibilityRole="header"
          >
            {title}
          </Text>
          {subtitle === undefined ? null : (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
        </View>
      )}

      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  )
}

/**
 * La flèche n'apparaît que s'il y a où revenir.
 *
 * Sur une racine d'onglet, un retour visible ne mènerait nulle part — ou pire,
 * hors de l'application.
 */
function AppBar() {
  const router = useRouter()
  const canGoBack = router.canGoBack()

  return (
    <View style={styles.appBar}>
      <View style={styles.appBarSide}>
        {canGoBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            onPress={() => router.back()}
            hitSlop={spacing.base}
            style={styles.back}
          >
            <BackIcon color={theme.text.primary} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.wordmark} accessibilityRole="header">
        MOTOBOY
      </Text>

      {/* Contrepoids : sans lui, le mot-symbole se décale quand la flèche
          apparaît. */}
      <View style={styles.appBarSide} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.surface.page,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.surface.border,
  },
  appBarSide: {
    width: TOUCH_TARGET,
  },
  back: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  wordmark: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: theme.text.brand,
  },
  heading: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight['2xl'],
    fontWeight: '700',
    letterSpacing: -0.5,
    color: theme.text.primary,
  },
  subtitle: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.secondary,
  },
  body: {
    flex: 1,
  },
})
