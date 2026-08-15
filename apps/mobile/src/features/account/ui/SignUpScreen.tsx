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
  type CredentialsForm,
} from '../model/auth'

/**
 * Création de compte.
 *
 * **Aucun mot de passe.** L'identité tient au numéro, et sa preuve au code reçu
 * par SMS : il n'y a donc rien à choisir, rien à retenir, et rien à réinitialiser
 * le jour où c'est oublié. C'est aussi ce qui permet de créer un compte en gare,
 * debout, en trente secondes.
 */
export function SignUpScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const describe = useErrorMessage()

  const { next } = useLocalSearchParams<{ next?: string }>()

  const [form, setForm] = useState<CredentialsForm>({
    phone: '',
    firstName: '',
    lastName: '',
    email: '',
  })

  const request = useRequestOtp()

  const submitted: CredentialsForm = { ...form, phone: toInternational(form.phone) }
  const error = validate(submitted, 'signUp')

  function submit() {
    if (error !== null) return

    request.mutate(
      { form: submitted, intent: 'signUp' },
      {
        onSuccess: (challenge) => {
          router.push({
            pathname: '/account/verify',
            params: {
              phone: submitted.phone,
              purpose: 'REGISTRATION',
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
    <Screen>
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
              {t('account.signUp')}
            </Text>
            <Text style={styles.subtitle}>{t('account.signUpBody')}</Text>
          </View>

          <View style={styles.card}>
            {/*
              Prénom et nom séparés, là où la maquette montre « Nom complet » :
              le contrat les veut distincts, et découper une chaîne à l'espace se
              trompe dès le premier nom composé.
            */}
            <TextField
              label={t('account.firstName')}
              value={form.firstName}
              onChangeText={(firstName) => setForm((current) => ({ ...current, firstName }))}
              autoCapitalize="words"
              textContentType="givenName"
            />
            <TextField
              label={t('account.lastName')}
              value={form.lastName}
              onChangeText={(lastName) => setForm((current) => ({ ...current, lastName }))}
              autoCapitalize="words"
              textContentType="familyName"
            />
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
            <TextField
              label={t('account.emailOptional')}
              value={form.email}
              onChangeText={(email) => setForm((current) => ({ ...current, email }))}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
            />

            {request.error ? (
              <Text style={styles.error}>{describe(request.error)}</Text>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace({
                pathname: '/account/sign-in',
                ...(next === undefined ? {} : { params: { next } }),
              })
            }
            style={styles.switch}
          >
            <Text style={styles.switchLabel}>{t('account.haveAccount')}</Text>
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
    fontWeight: '700',
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
