import { Pressable, StyleSheet, Text, View } from 'react-native'
import { fontSize, radius, spacing, theme, TOUCH_TARGET } from './theme'

export interface FieldProps {
  label: string
  /** Valeur choisie, ou `null` tant que rien ne l'est. */
  value: string | null
  placeholder: string
  onPress: () => void
  /** Ajouté à l'annonce vocale — « Départ, Douala, bouton ». */
  hint?: string
}

/**
 * Un champ qui ouvre un sélecteur, plutôt qu'un champ de saisie.
 *
 * Ville et date ne se tapent pas : la ville vient d'un référentiel fermé, et
 * une date saisie à la main produit autant de formats que d'utilisateurs. Le
 * champ n'est donc qu'un bouton qui montre l'état courant.
 */
export function Field({ label, value, placeholder, onPress, hint }: FieldProps) {
  const filled = value !== null && value !== ''

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${filled ? value : placeholder}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.field, pressed ? styles.pressed : null]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={filled ? styles.value : styles.placeholder} numberOfLines={1}>
        {filled ? value : placeholder}
      </Text>
    </Pressable>
  )
}

export function FieldGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  field: {
    minHeight: TOUCH_TARGET + spacing.sm,
    justifyContent: 'center',
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: theme.surface.raised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: fontSize.lg,
    color: theme.text.primary,
    fontWeight: '600',
  },
  placeholder: {
    fontSize: fontSize.lg,
    color: theme.text.muted,
  },
})
