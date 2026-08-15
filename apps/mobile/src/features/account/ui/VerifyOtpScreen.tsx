import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ApiError } from '@motoboy/api-client'
import {
  Button,
  fontSize,
  lineHeight,
  radius,
  Screen,
  spacing,
  theme,
  TimerIcon,
} from '../../../shared/ui'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { useResendOtp, useVerifyOtp } from '../api/useAuth'
import {
  maskPhone,
  normaliseCode,
  OTP_LENGTH,
  RESEND_DELAY_SECONDS,
} from '../model/auth'

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
  const input = useRef<TextInput>(null)

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
        <Text style={styles.instruction}>
          {t('account.otp.instruction', { count: OTP_LENGTH })}
        </Text>
        <Text style={styles.phone}>{maskPhone(phone)}</Text>

        <CodeBoxes
          value={code}
          onChange={(value) => setCode(normaliseCode(value))}
          onFocusRequest={() => input.current?.focus()}
          inputRef={input}
          label={t('account.otp.codeField')}
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
                  setCode('')
                  verify.reset()
                },
              },
            )
          }
          style={styles.resend}
        >
          {wait > 0 ? <TimerIcon color={theme.text.muted} size={18} /> : null}
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
          disabled={code.length < OTP_LENGTH}
          busy={verify.isPending}
        />
      </View>
    </Screen>
  )
}

/**
 * Le code, une case par chiffre.
 *
 * **Un seul champ, invisible, posé par-dessus les cases.** Six champs distincts
 * obligeraient à gérer le passage de l'un à l'autre, la suppression qui recule,
 * et le collage d'un code entier depuis le SMS — trois comportements qu'un
 * champ unique offre déjà, et que le remplissage automatique d'Android sait
 * viser.
 */
function CodeBoxes({
  value,
  onChange,
  onFocusRequest,
  inputRef,
  label,
}: {
  value: string
  onChange: (value: string) => void
  onFocusRequest: () => void
  inputRef: React.RefObject<TextInput | null>
  label: string
}) {
  return (
    <Pressable
      onPress={onFocusRequest}
      // La rangée entière est la cible : viser une case de 44 dp au pouce, en
      // marchant, rate une fois sur trois.
      accessibilityRole="none"
      style={styles.boxes}
    >
      {Array.from({ length: OTP_LENGTH }, (_, index) => (
        <View
          key={index}
          style={[styles.box, index === value.length ? styles.boxNext : null]}
        >
          <Text style={styles.boxDigit}>{value[index] ?? ''}</Text>
        </View>
      ))}

      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        autoFocus
        style={styles.hiddenInput}
        // `caretHidden` plutôt qu'une opacité nulle seule : sur Android le
        // curseur reste peint par-dessus les cases.
        caretHidden
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  instruction: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  phone: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  boxes: {
    flexDirection: 'row',
    gap: spacing.base,
    marginVertical: spacing.md,
  },
  box: {
    width: 46,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: theme.surface.border,
    backgroundColor: theme.surface.card,
  },
  /** La case en attente porte le focus : on voit où le prochain chiffre ira. */
  boxNext: {
    borderColor: theme.surface.brand,
  },
  boxDigit: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.primary,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  attempts: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  resend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  resendLabel: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.brand,
  },
  resendWaiting: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text.muted,
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
    textAlign: 'center',
  },
})
