import { useState } from 'react'
import { Navigate } from 'react-router'
import { describeError } from '../../lib/errors'
import { useCurrentUser, useRequestOtp, useVerifyOtp } from './useAuth'
import { Logo } from '../../shared/ui'
import { destinationFor } from './destination'

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
  const me = useCurrentUser()

  const awaitingCode = request.isSuccess

  /*
   * **Une session déjà ouverte n'a rien à faire sur ce formulaire.**
   *
   * Le compte décide de sa destination : le même formulaire sert
   * l'administration, l'agence, le quai et le propriétaire. Sans cette
   * redirection, on saisissait son code et on restait là — authentifié, sans que
   * rien ne le dise et sans nulle part où aller. Il fallait connaître l'URL par
   * cœur, ce qui n'est demandable à personne.
   */
  if (me.data) {
    return <Navigate to={destinationFor(me.data.roles)} replace />
  }

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
        {/*
          Ici la vignette complète, carré compris : la page est claire, et c'est
          le seul repère avant d'avoir saisi quoi que ce soit.
        */}
        <Logo size={44} title="MOTOBOY" />
        {/*
          « Espace professionnel » et non « administration » : ce formulaire est
          la seule porte pour quatre espaces, et l'annoncer comme celui d'un seul
          fait croire aux trois autres qu'ils se connectent ailleurs.
        */}
        <h1 className="mt-3 text-xl font-bold text-ink-700">Espace professionnel</h1>
        <p className="mt-1 mb-6 text-sm text-neutral-500">
          {awaitingCode
            ? 'Saisissez le code reçu par SMS.'
            : 'Agence, embarquement, administration : le même numéro ouvre votre espace.'}
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
            <label
              className="mt-4 block text-xs font-medium text-neutral-700"
              htmlFor="code"
            >
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
