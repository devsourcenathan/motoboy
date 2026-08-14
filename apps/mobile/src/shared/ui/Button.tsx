import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
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
  style?: ViewStyle
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
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
        pressed && !inactive ? styles.pressed : null,
        inactive ? styles.inactive : null,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={variant === 'primary' ? theme.text.inverse : theme.text.brand}
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' ? styles.labelOnBrand : styles.labelOnPage,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    // Voir `TOUCH_TARGET` : le produit s'utilise debout, en gare, souvent d'une
    // seule main.
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  primary: {
    backgroundColor: theme.surface.brand,
  },
  secondary: {
    backgroundColor: theme.surface.brandSoft,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
  },
  inactive: {
    opacity: 0.5,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  labelOnBrand: {
    color: theme.text.inverse,
  },
  labelOnPage: {
    color: theme.text.brand,
  },
})
