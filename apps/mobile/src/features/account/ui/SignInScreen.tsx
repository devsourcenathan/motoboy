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
  TOUCH_TARGET,
} from '../../../shared/ui'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { markAuthChoiceMade } from '../../onboarding'
import { useRequestOtp } from '../api/useAuth'
import {
  DIALLING_CODE,
  toInternational,
  validate,
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

  /*
   * Les noms restent dans le formulaire bien que l'écran ne les demande pas :
   * la validation de connexion ne les regarde pas, et la forme partagée évite
   * un second type qui divergerait au premier champ ajouté.
   */
  const [form, setForm] = useState<CredentialsForm>({
    phone: '',
    firstName: '',
    lastName: '',
    email: '',
  })

  const request = useRequestOtp()

  /*
   * Le champ ne contient que ce qui suit l'indicatif affiché. Le numéro complet
   * se compose ici — et une seule fois — pour que la validation et l'envoi
   * portent exactement sur ce qui partira au serveur.
   */
  const submitted: CredentialsForm = { ...form, phone: toInternational(form.phone) }
  const error = validate(submitted, 'signIn')

  function submit() {
    if (error !== null) return

    request.mutate(
      { form: submitted, intent: 'signIn' },
      {
        onSuccess: (challenge) => {
          router.push({
            pathname: '/account/verify',
            params: {
              phone: submitted.phone,
              purpose: 'LOGIN',
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
              {t('account.welcome')}
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

          {request.error ? (
            <Text style={styles.error}>{describe(request.error)}</Text>
          ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/account/sign-up',
                ...(next === undefined ? {} : { params: { next } }),
              })
            }
            style={styles.switch}
          >
            <Text style={styles.switchLabel}>
              {t('account.noAccount')}
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

          {/*
            **L'entrée sans compte, offerte et non cachée.**

            Chercher un départ fonctionne sans session (§35) : c'est la promesse
            du produit, et l'enfermer derrière une inscription perdrait les gens
            sur une question qu'ils ne se posaient pas encore. Le compte devient
            nécessaire au moment de réserver, et c'est là qu'on le demandera.

            Proposé seulement quand on arrive **par le lancement** : si la
            connexion a été demandée pour continuer une action précise — `next`
            est alors renseigné —, contourner ne mènerait nulle part.
          */}
          {next === undefined ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void markAuthChoiceMade()
                router.replace('/search')
              }}
              style={styles.guest}
            >
              <Text style={styles.guestLabel}>{t('account.continueAsGuest')}</Text>
            </Pressable>
          ) : null}
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
    /*
     * **De l'air en haut, et une gouttière plus large.**
     *
     * La maquette respire : le titre commence loin du bord, et les blocs sont
     * nettement séparés. C'est ce qui distingue un écran d'accueil d'un
     * formulaire administratif — et c'est le premier écran que voit quelqu'un
     * qui télécharge l'application.
     */
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  guest: {
    alignItems: 'center',
    paddingTop: spacing.md,
    minHeight: TOUCH_TARGET,
  },
  guestLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: theme.text.secondary,
    textDecorationLine: 'underline',
  },
  heading: {
    gap: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  title: {
    /*
     * Marine et non noir : c'est la couleur d'identité, et le premier écran est
     * l'endroit où la marque doit se voir sans crier. L'orange reste réservé à
     * l'action — ici, le bouton.
     */
    fontSize: fontSize['3xl'],
    lineHeight: lineHeight['3xl'],
    fontWeight: '800',
    letterSpacing: -0.5,
    color: theme.text.ink,
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
    // Plus généreux que les cartes de contenu : un champ qu'on remplit au
    // clavier a besoin de marge autour, sinon la saisie touche les bords.
    gap: spacing.md,
    padding: spacing.lg,
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
