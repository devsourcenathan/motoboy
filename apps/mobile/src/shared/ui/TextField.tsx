import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { fontSize, radius, spacing, theme, TOUCH_TARGET } from './theme'

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string
  /** Message d'erreur, affiché sous le champ. */
  error?: string | null
  hint?: string
  /**
   * Texte fixe collé devant la saisie — l'indicatif `+237`.
   *
   * Affiché plutôt que pré-rempli : pré-remplir laisse l'effacer, et un numéro
   * parti sans indicatif est refusé par le serveur après coup. Ici il ne fait
   * pas partie du champ, donc il ne peut pas disparaître.
   */
  prefix?: string
}

/**
 * Champ de saisie.
 *
 * L'étiquette est **visible**, pas seulement dans le placeholder : celui-ci
 * disparaît dès la première lettre, et un formulaire de quatre champs devient
 * alors indevinable pour qui l'a commencé puis interrompu — ce qui arrive en
 * gare plus qu'ailleurs.
 */
export function TextField({ label, error, hint, prefix, ...input }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.field, error ? styles.inputError : null]}>
        {prefix === undefined ? null : (
          <View style={styles.prefix}>
            <Text style={styles.prefixLabel}>{prefix}</Text>
          </View>
        )}
        <TextInput
          {...input}
          accessibilityLabel={prefix === undefined ? label : `${label}, ${prefix}`}
          placeholderTextColor={theme.text.muted}
          style={styles.input}
        />
      </View>
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
  /** Le cadre est porté par l'enveloppe : l'indicatif est dedans, pas à côté. */
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET,
    backgroundColor: theme.surface.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  prefix: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRightWidth: 1,
    borderRightColor: theme.surface.border,
  },
  prefixLabel: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.secondary,
  },
  input: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.base,
    color: theme.text.primary,
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
