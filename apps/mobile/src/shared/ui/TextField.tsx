import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { fontSize, radius, spacing, theme, TOUCH_TARGET } from './theme'

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string
  /** Message d'erreur, affiché sous le champ. */
  error?: string | null
  hint?: string
}

/**
 * Champ de saisie.
 *
 * L'étiquette est **visible**, pas seulement dans le placeholder : celui-ci
 * disparaît dès la première lettre, et un formulaire de quatre champs devient
 * alors indevinable pour qui l'a commencé puis interrompu — ce qui arrive en
 * gare plus qu'ailleurs.
 */
export function TextField({ label, error, hint, ...input }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={theme.text.muted}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {hint === undefined || error ? null : <Text style={styles.hint}>{hint}</Text>}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs / 2,
  },
  label: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.lg,
    color: theme.text.primary,
    backgroundColor: theme.surface.raised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  inputError: {
    borderColor: theme.text.danger,
  },
  hint: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  error: {
    fontSize: fontSize.sm,
    color: theme.text.danger,
  },
})
