import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { fontSize, lineHeight, radius, spacing, theme, TOUCH_TARGET } from './theme'

export interface FieldProps {
  label: string
  /** Valeur choisie, ou `null` tant que rien ne l'est. */
  value: string | null
  placeholder: string
  onPress: () => void
  /** Glyphe à gauche — cible au départ, épingle à l'arrivée. */
  icon?: ReactNode
  /**
   * Sans cadre ni fond.
   *
   * Pour les champs posés **dans** un panneau qui porte déjà sa bordure : deux
   * cadres imbriqués font lire deux niveaux là où il n'y en a qu'un.
   */
  bare?: boolean
  /** Ajouté à l'annonce vocale — « Départ, Douala, bouton ». */
  hint?: string
}

/**
 * Un champ qui ouvre un sélecteur, plutôt qu'un champ de saisie.
 *
 * Ville et date ne se tapent pas : la ville vient d'un référentiel fermé, et
 * une date saisie à la main produit autant de formats que d'utilisateurs. Le
 * champ n'est donc qu'un bouton qui montre l'état courant.
 *
 * Rayon 8 et non capsule : le système réserve l'arrondi prononcé aux actions,
 * et garde les champs « structurés et professionnels ».
 */
export function Field({
  label,
  value,
  placeholder,
  onPress,
  icon,
  hint,
  bare = false,
}: FieldProps) {
  const filled = value !== null && value !== ''

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${filled ? value : placeholder}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.field,
        bare ? styles.bare : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {icon === undefined ? null : <View style={styles.icon}>{icon}</View>}

      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={filled ? styles.value : styles.placeholder} numberOfLines={1}>
          {filled ? value : placeholder}
        </Text>
      </View>
    </Pressable>
  )
}

export function FieldGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET + spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.base,
    backgroundColor: theme.surface.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  bare: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  icon: {
    width: 24,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    gap: 1,
  },
  pressed: {
    backgroundColor: theme.surface.raised,
  },
  label: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.text.muted,
  },
  value: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.primary,
    fontWeight: '600',
  },
  placeholder: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.muted,
  },
})
