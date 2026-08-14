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
import { Button, fontSize, Screen, spacing, TextField, theme } from '../../../shared/ui'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useRequestOtp } from '../api/useAuth'
import { validate, type AuthIntent, type CredentialsForm } from '../model/auth'

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
  const error = validate(form, intent)

  function submit() {
    if (error !== null) return

    request.mutate(
      { form, intent },
      {
        onSuccess: (challenge) => {
          router.push({
            pathname: '/account/verify',
            params: {
              phone: form.phone,
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
    <Screen title={intent === 'signUp' ? t('account.signUp') : t('account.signIn')}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {next === undefined ? null : (
            <Text style={styles.why}>{t('account.whyNeeded')}</Text>
          )}

          <TextField
            label={t('account.phone')}
            hint={t('account.phoneHint')}
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
    padding: spacing.lg,
    gap: spacing.lg,
  },
  why: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
  },
  switch: {
    paddingVertical: spacing.sm,
  },
  switchLabel: {
    fontSize: fontSize.base,
    color: theme.text.brand,
    fontWeight: '600',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  error: {
    fontSize: fontSize.base,
    color: theme.text.danger,
  },
})
