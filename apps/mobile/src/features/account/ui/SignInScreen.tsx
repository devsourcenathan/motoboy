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
    <Screen chrome={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/*
            La marque tient lieu d'en-tête ici : c'est le seul écran qu'on peut
            atteindre sans jamais avoir vu le reste de l'application, et il doit
            dire chez qui l'on saisit son numéro.
          */}
          <View style={styles.hero}>
            <View style={styles.mark}>
              <Text style={styles.markLetter}>M</Text>
            </View>
            <Text style={styles.wordmark} accessibilityRole="header">
              MOTOBOY
            </Text>
            <Text style={styles.tagline}>{t('account.tagline')}</Text>
          </View>

          <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {intent === 'signUp' ? t('account.signUp') : t('account.signIn')}
          </Text>
          <Text style={styles.cardBody}>
            {next === undefined ? t('account.authBody') : t('account.whyNeeded')}
          </Text>

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
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  /*
   * Un monogramme, pas un logotype : aucun fichier de marque n'existe encore,
   * et une image absente laisserait un carré vide au premier écran vu.
   */
  mark: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.brand,
    marginBottom: spacing.base,
  },
  markLetter: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '800',
    color: theme.text.inverse,
  },
  wordmark: {
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight['2xl'],
    fontWeight: '800',
    letterSpacing: 1,
    color: theme.text.brand,
  },
  tagline: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
  },
  card: {
    ...sharedStyles.card,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  cardBody: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.text.secondary,
    marginBottom: spacing.xs,
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
