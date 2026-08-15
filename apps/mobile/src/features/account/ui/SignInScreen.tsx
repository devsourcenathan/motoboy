import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  Button,
  fontSize,
  lineHeight,
  radius,
  Screen,
  sharedStyles,
  spacing,
  TextField,
  theme,
} from '../../../shared/ui'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useRequestOtp } from '../api/useAuth'
import {
  DIALLING_CODE,
  toInternational,
  validate,
  type AuthIntent,
  type CredentialsForm,
} from '../model/auth'

/**
 * Connexion ou inscription, sur le même écran.
 *
 * Les deux ne diffèrent que par deux champs de nom : en faire deux écrans
 * obligerait le passager à comprendre, avant de commencer, s'il a déjà un
 * compte — question à laquelle il ne sait pas toujours répondre.
 *
 * **La connexion arrive tard dans le parcours.** La recherche, les résultats et
 * le plan de sièges fonctionnent sans compte ; c'est seulement pour finaliser
 * la réservation qu'il en faut un (§35). Le message le dit, plutôt que de
 * laisser croire à un mur.
 */
export function SignInScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const describe = useErrorMessage()

  // `next` transporte la destination d'origine : quelqu'un renvoyé ici depuis
  // le plan de sièges doit y revenir, pas atterrir sur l'accueil.
  const { next } = useLocalSearchParams<{ next?: string }>()

  const [intent, setIntent] = useState<AuthIntent>('signIn')
  const [form, setForm] = useState<CredentialsForm>({
    phone: '',
    firstName: '',
    lastName: '',
  })

  const request = useRequestOtp()

  /*
   * Le champ ne contient que ce qui suit l'indicatif affiché. Le numéro complet
   * se compose ici — et une seule fois — pour que la validation et l'envoi
   * portent exactement sur ce qui partira au serveur.
   */
  const submitted: CredentialsForm = { ...form, phone: toInternational(form.phone) }
  const error = validate(submitted, intent)

  function submit() {
    if (error !== null) return

    request.mutate(
      { form: submitted, intent },
      {
        onSuccess: (challenge) => {
          router.push({
            pathname: '/account/verify',
            params: {
              phone: submitted.phone,
              purpose: intent === 'signUp' ? 'REGISTRATION' : 'LOGIN',
              expiresAt: challenge.expires_at,
              attempts: String(challenge.attempts_remaining),
              ...(next === undefined ? {} : { next }),
            },
          })
        },
      },
    )
  }

  return (
    <Screen chrome={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heading}>
            <Text style={styles.title} accessibilityRole="header">
              {intent === 'signUp' ? t('account.signUp') : t('account.welcome')}
            </Text>
            <Text style={styles.subtitle}>
              {next === undefined ? t('account.authBody') : t('account.whyNeeded')}
            </Text>
          </View>

          <View style={styles.card}>
          <TextField
            label={t('account.phone')}
            hint={t('account.phoneHint')}
            prefix={DIALLING_CODE}
            value={form.phone}
            onChangeText={(phone) => setForm((current) => ({ ...current, phone }))}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
          />

          {intent === 'signUp' ? (
            <>
              <TextField
                label={t('account.firstName')}
                value={form.firstName}
                onChangeText={(firstName) =>
                  setForm((current) => ({ ...current, firstName }))
                }
                autoCapitalize="words"
                textContentType="givenName"
              />
              <TextField
                label={t('account.lastName')}
                value={form.lastName}
                onChangeText={(lastName) =>
                  setForm((current) => ({ ...current, lastName }))
                }
                autoCapitalize="words"
                textContentType="familyName"
              />
            </>
          ) : null}

          {request.error ? (
            <Text style={styles.error}>{describe(request.error)}</Text>
          ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setIntent(intent === 'signUp' ? 'signIn' : 'signUp')}
            style={styles.switch}
          >
            <Text style={styles.switchLabel}>
              {intent === 'signUp' ? t('account.haveAccount') : t('account.noAccount')}
            </Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t('account.continue')}
            onPress={submit}
            disabled={error !== null}
            busy={request.isPending}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  heading: {
    gap: spacing.xs,
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
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
  /*
   * Un monogramme, pas un logotype : aucun fichier de marque n'existe encore,
   * et une image absente laisserait un carré vide au premier écran vu.
   */
  card: {
    ...sharedStyles.card,
    gap: spacing.sm,
    padding: spacing.md,
  },
  switch: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  switchLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: theme.text.brand,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: theme.surface.card,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  error: {
    fontSize: fontSize.sm,
    color: theme.text.danger,
  },
})
