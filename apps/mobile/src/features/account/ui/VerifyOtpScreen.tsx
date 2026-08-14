import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ApiError } from '@motoboy/api-client'
import { Button, fontSize, Screen, spacing, TextField, theme } from '../../../shared/ui'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useResendOtp, useVerifyOtp } from '../api/useAuth'
import { normaliseCode, RESEND_DELAY_SECONDS } from '../model/auth'

type Purpose = 'REGISTRATION' | 'LOGIN'

/**
 * Saisie du code reçu par SMS.
 *
 * **Le renvoi attend.** Chaque envoi coûte un SMS, et l'OTP est le seul canal
 * sans alternative : un bouton toujours actif invite à insister, et la facture
 * suit. Le décompte laisse aussi le temps au message d'arriver sur un réseau
 * lent, avant que le passager ne conclue qu'il s'est perdu (I8).
 */
export function VerifyOtpScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const describe = useErrorMessage()

  const params = useLocalSearchParams<{
    phone: string
    purpose: Purpose
    attempts?: string
    next?: string
  }>()

  const phone = params.phone ?? ''
  const purpose: Purpose = params.purpose === 'REGISTRATION' ? 'REGISTRATION' : 'LOGIN'

  const [code, setCode] = useState('')
  const [attempts, setAttempts] = useState(() => Number(params.attempts ?? 4) || 4)
  const [wait, setWait] = useState(RESEND_DELAY_SECONDS)

  const verify = useVerifyOtp()
  const resend = useResendOtp()

  useEffect(() => {
    if (wait <= 0) return

    const timer = setInterval(() => setWait((seconds) => Math.max(0, seconds - 1)), 1000)

    return () => clearInterval(timer)
  }, [wait])

  function submit() {
    verify.mutate(
      { phone, code, purpose },
      {
        onSuccess: () => {
          // `replace` : revenir en arrière sur un écran de code déjà consommé
          // ne mène nulle part.
          router.replace(
            params.next === undefined ? '/account' : (params.next as '/account'),
          )
        },
        onError: (error) => {
          // Le serveur décompte les tentatives : les afficher évite au passager
          // de découvrir le blocage au dernier essai.
          if (error instanceof ApiError && error.code === 'OTP_INVALID') {
            setAttempts((remaining) => Math.max(0, remaining - 1))
          }
        },
      },
    )
  }

  const expired =
    verify.error instanceof ApiError &&
    (verify.error.code === 'OTP_EXPIRED' || verify.error.code === 'OTP_TOO_MANY_ATTEMPTS')

  return (
    <Screen title={t('account.otp.title')}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sentTo}>{t('account.otp.sentTo', { phone })}</Text>

        <TextField
          label={t('account.otp.code')}
          value={code}
          onChangeText={(value) => setCode(normaliseCode(value))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={8}
          autoFocus
        />

        {verify.error ? (
          <Text style={styles.error}>
            {expired ? t('account.otp.expired') : describe(verify.error)}
          </Text>
        ) : null}

        {!expired && attempts < 4 ? (
          <Text style={styles.attempts}>
            {t('account.otp.attemptsLeft', { count: attempts })}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: wait > 0 }}
          disabled={wait > 0 || resend.isPending}
          onPress={() =>
            resend.mutate(
              { phone, purpose },
              {
                onSuccess: () => {
                  setWait(RESEND_DELAY_SECONDS)
                  setAttempts(4)
                  verify.reset()
                },
              },
            )
          }
          style={styles.resend}
        >
          <Text style={wait > 0 ? styles.resendWaiting : styles.resendLabel}>
            {wait > 0
              ? t('account.otp.resendIn', { seconds: wait })
              : t('account.otp.resend')}
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={t('account.otp.verify')}
          onPress={submit}
          disabled={code.length < 4}
          busy={verify.isPending}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sentTo: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
  },
  attempts: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  resend: {
    paddingVertical: spacing.sm,
  },
  resendLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: theme.text.brand,
  },
  resendWaiting: {
    fontSize: fontSize.base,
    color: theme.text.muted,
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
