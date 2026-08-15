import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unwrap, type OtpChallenge, type User } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'
import { session } from '../../../shared/session/session'
import { deviceLocale } from '../../../shared/i18n'
import { normalisePhone, type CredentialsForm } from '../model/auth'

/**
 * Le profil courant, ou rien.
 *
 * Sert de test de session : le jeton peut avoir été révoqué côté serveur, et
 * seul un appel le dit. Un `401` purge la session par le client d'API, sans que
 * cet écran ait à s'en occuper.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me(),
    retry: false,
    queryFn: async ({ signal }) => {
      const token = await session.token()

      if (token === null) return null

      const response = await api.GET('/v1/me', { signal })

      return unwrap(response) as User
    },
  })
}

/**
 * Demande un code.
 *
 * L'inscription et la connexion diffèrent par ce qu'elles envoient, pas par ce
 * qu'elles rendent : les deux répondent un défi OTP, et la suite est identique.
 *
 * La langue de l'appareil part avec l'inscription : elle détermine celle de
 * l'OTP, **donc du tout premier message reçu**, avant même que le compte
 * existe (I10).
 */
export function useRequestOtp() {
  return useMutation({
    mutationFn: async ({
      form,
      intent,
    }: {
      form: CredentialsForm
      intent: 'signIn' | 'signUp'
    }) => {
      const phone = normalisePhone(form.phone)

      const response =
        intent === 'signUp'
          ? await api.POST('/v1/auth/register', {
              body: {
                phone,
                first_name: form.firstName.trim(),
                last_name: form.lastName.trim(),
                // Omis plutôt qu'envoyé vide : une chaîne vide serait stockée
                // comme une adresse, et le serveur la refuserait au format.
                ...(form.email.trim() === '' ? {} : { email: form.email.trim() }),
                locale: deviceLocale(),
              },
            })
          : await api.POST('/v1/auth/login', { body: { phone } })

      return unwrap(response) as OtpChallenge
    },
  })
}

export function useResendOtp() {
  return useMutation({
    mutationFn: async ({
      phone,
      purpose,
    }: {
      phone: string
      purpose: 'REGISTRATION' | 'LOGIN'
    }) => {
      const response = await api.POST('/v1/auth/otp/resend', {
        body: { phone: normalisePhone(phone), purpose },
      })

      return unwrap(response) as OtpChallenge
    },
  })
}

/**
 * Vérifie le code et ouvre la session.
 *
 * Le jeton part directement dans le coffre du système : le garder en mémoire
 * obligerait à redemander un code à chaque démarrage, et chaque code coûte un
 * SMS.
 */
export function useVerifyOtp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      phone,
      code,
      purpose,
    }: {
      phone: string
      code: string
      purpose: 'REGISTRATION' | 'LOGIN'
    }) => {
      const response = await api.POST('/v1/auth/otp/verify', {
        body: { phone: normalisePhone(phone), code, purpose },
      })

      return unwrap(response) as { token: string; user: User }
    },
    onSuccess: async ({ token, user }) => {
      await session.start(token)
      queryClient.setQueryData(queryKeys.me(), user)
    },
  })
}

/**
 * Ferme la session.
 *
 * Le cache est vidé **avec** elle : y laisser les réservations d'un compte les
 * rendrait visibles au suivant, sur un téléphone qui change de mains.
 */
export function useSignOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // Le serveur révoque le jeton ; si l'appel échoue — hors ligne — la
      // session locale se ferme quand même. Laisser quelqu'un connecté parce
      // que le réseau manque serait le pire des deux mondes.
      await api.POST('/v1/auth/logout', {}).catch(() => undefined)
    },
    onSettled: async () => {
      await session.end()
      queryClient.clear()
    },
  })
}
