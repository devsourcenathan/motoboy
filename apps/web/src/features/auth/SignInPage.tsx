import { useState } from 'react'
import { describeError } from '../../lib/errors'
import { useRequestOtp, useVerifyOtp } from './useAuth'

/**
 * Connexion au back-office.
 *
 * Même mécanisme que le mobile — téléphone puis code — parce que c'est la seule
 * identité que la plateforme connaisse : il n'y a pas de mot de passe à
 * réinitialiser, donc rien à voler dans une base.
 *
 * En **deux étapes sur un seul écran** : passer à une page dédiée au code ferait
 * perdre le numéro saisi à la moindre correction, et il n'y a rien à afficher
 * entre les deux.
 */
export function SignInPage() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')

  const request = useRequestOtp()
  const verify = useVerifyOtp()

  const awaitingCode = request.isSuccess

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        className="w-full max-w-sm rounded-xl bg-neutral-0 p-8 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()

          if (awaitingCode) verify.mutate({ phone: phone.trim(), code: code.trim() })
          else request.mutate(phone.trim())
        }}
      >
        <h1 className="text-xl font-bold text-ink-700">MOTOBOY — administration</h1>
        <p className="mt-1 mb-6 text-sm text-neutral-500">
          {awaitingCode
            ? 'Saisissez le code reçu par SMS.'
            : 'Connectez-vous avec votre numéro.'}
        </p>

        <label className="block text-xs font-medium text-neutral-700" htmlFor="phone">
          Téléphone
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          placeholder="+237 6XX XX XX XX"
          value={phone}
          // Verrouillé une fois le code parti : le modifier viserait un autre
          // compte que celui à qui le SMS a été envoyé.
          disabled={awaitingCode}
          onChange={(event) => setPhone(event.target.value)}
        />

        {awaitingCode ? (
          <>
            <label className="mt-4 block text-xs font-medium text-neutral-700" htmlFor="code">
              Code à six chiffres
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-lg tracking-widest"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
          </>
        ) : null}

        <button
          type="submit"
          disabled={request.isPending || verify.isPending}
          className="mt-6 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-neutral-0 hover:bg-brand-600 disabled:opacity-50"
        >
          {awaitingCode ? 'Se connecter' : 'Recevoir un code'}
        </button>

        {request.error || verify.error ? (
          <p className="mt-4 text-sm whitespace-pre-line text-danger">
            {describeError(request.error ?? verify.error)}
          </p>
        ) : null}
      </form>
    </main>
  )
}
