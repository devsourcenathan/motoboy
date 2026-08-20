import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Button } from './Button'
import { fontSize, lineHeight, radius, spacing, theme } from './theme'

export interface EmptyStateProps {
  /** L'icône, dans un disque teinté. Facultative. */
  icon?: ReactNode
  title: string
  /** Une phrase, pas un paragraphe : ce qui manque, et ce qu'on peut y faire. */
  body?: string
  /** L'action qui sort de l'état vide. Une seule — deux se valent rarement. */
  action?: { label: string; onPress: () => void }
  /**
   * `neutral` : rien à cet endroit, c'est normal.
   * `problem` : quelque chose a échoué, et réessayer a du sens.
   */
  tone?: 'neutral' | 'problem'
}

/**
 * Ce qu'on montre quand il n'y a rien à montrer.
 *
 * **Une phrase seule au milieu d'un écran se lit comme un bogue.** Le vide passe
 * pour une panne : rien n'indique si l'écran a fini de charger, si la recherche
 * n'a rien donné, ou si l'application est cassée. Une forme — disque, titre,
 * explication, action — dit que cet état était prévu.
 *
 * L'action compte autant que le texte : un état vide sans issue laisse le
 * passager reculer, et il recule souvent hors du parcours.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  tone = 'neutral',
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon === undefined ? null : (
        <View style={[styles.badge, tone === 'problem' ? styles.badgeProblem : null]}>
          {icon}
        </View>
      )}

      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>

      {body === undefined ? null : <Text style={styles.body}>{body}</Text>}

      {action === undefined ? null : (
        <View style={styles.action}>
          <Button label={action.label} onPress={action.onPress} variant="secondary" />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  badge: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    // Orange très pâle : la teinte de l'action, sans en être une.
    backgroundColor: theme.surface.brandSoft,
    marginBottom: spacing.xs,
  },
  badgeProblem: {
    backgroundColor: theme.surface.dangerSoft,
  },
  title: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
    textAlign: 'center',
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.secondary,
    textAlign: 'center',
    // Une ligne trop large fatigue : on borne la mesure plutôt que la police.
    maxWidth: 320,
  },
  action: {
    marginTop: spacing.base,
    alignSelf: 'stretch',
    maxWidth: 260,
  },
})
