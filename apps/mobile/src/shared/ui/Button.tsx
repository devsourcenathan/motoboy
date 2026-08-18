import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { fontSize, radius, spacing, theme, TOUCH_TARGET } from './theme'

type Variant = 'primary' | 'secondary' | 'ghost'

export interface ButtonProps {
  label: string
  onPress: () => void
  variant?: Variant
  /**
   * Occupé.
   *
   * Le bouton reste **affiché à sa taille** et devient inactif : le remplacer
   * par un indicateur ferait sauter la mise en page au moment précis où
   * l'utilisateur vient d'appuyer, et un second appui partirait ailleurs.
   */
  busy?: boolean
  disabled?: boolean
  /** Glyphe placé avant le libellé — loupe, QR, partage. */
  icon?: ReactNode
  style?: ViewStyle
}

/**
 * Bouton d'action.
 *
 * **Capsule et non rectangle** : le système réserve le rayon 24 aux actions,
 * pour qu'elles ne se confondent pas avec les cartes d'information qui portent
 * un rayon de 16.
 *
 * Le primaire est **bleu plein**, pas or. Le document du système annonce
 * l'inverse, mais chaque maquette montre un CTA bleu et l'or en contour sur les
 * actions secondaires — « Télécharger PDF » contre « Partager ». L'écran fait
 * foi.
 *
 * L'état inactif porte un **aplat gris**, pas une simple opacité : à 50 %
 * d'opacité sur fond lavande, un bouton bleu reste bleu et se lit encore comme
 * disponible.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const inactive = disabled || busy

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        // À l'appui, l'élément perd son ombre : une pression physique vers la
        // surface plutôt qu'un changement de couleur.
        pressed && !inactive ? styles.pressed : null,
        inactive ? styles.inactive : null,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={inactive ? theme.text.muted : labelColor(variant)} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            style={[styles.label, { color: inactive ? theme.text.muted : labelColor(variant) }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

function labelColor(variant: Variant): string {
  if (variant === 'primary') return theme.text.inverse

  return variant === 'secondary' ? theme.text.ink : theme.text.brand
}

const styles = StyleSheet.create({
  base: {
    // Voir `TOUCH_TARGET` : le produit s'utilise debout, en gare, souvent d'une
    // seule main.
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  primary: {
    backgroundColor: theme.surface.brand,
  },
  /** Contour neutre — l'action présente mais non prioritaire. */
  secondary: {
    backgroundColor: theme.surface.card,
    borderColor: theme.surface.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.9,
  },
  inactive: {
    backgroundColor: theme.surface.inert,
    borderColor: 'transparent',
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
})
