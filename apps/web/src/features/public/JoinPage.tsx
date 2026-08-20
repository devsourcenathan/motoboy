import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router'
import { unwrap } from '@motoboy/api-client'
import { destinationFor } from '../auth/destination'
import { useCurrentUser, useVerifyOtp } from '../auth/useAuth'
import { api } from '../../lib/api'
import { describeError } from '../../lib/errors'
import { Button, ErrorNote, Field, INPUT, LocaleSwitch, Logo } from '../../shared/ui'

type Form = {
  name: string
  legal_name: string
  phone: string
  email: string
  manager_first_name: string
  manager_last_name: string
  manager_phone: string
}

const EMPTY: Form = {
  name: '',
  legal_name: '',
  phone: '',
  email: '',
  manager_first_name: '',
  manager_last_name: '',
  manager_phone: '',
}

/**
 * Déposer la candidature.
 *
 * **La langue de l'écran part avec le formulaire**, et ce n'est pas cosmétique :
 * elle décide de celle du SMS — le tout premier message reçu, avant même que le
 * compte existe. Une agence de Bamenda qui remplit ce formulaire en anglais ne
 * doit pas recevoir son code en français.
 */
function useRegisterAgency(locale: string) {
  return useMutation({
    mutationFn: async (form: Form) =>
      unwrap(
        await api.POST('/v1/agencies/register', {
          body: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            manager_first_name: form.manager_first_name.trim(),
            manager_last_name: form.manager_last_name.trim(),
            manager_phone: form.manager_phone.trim(),
            locale: locale === 'en' ? 'en' : 'fr',
            // Les facultatifs ne sont pas envoyés vides : une chaîne vide n'est
            // pas « non renseigné », et se ferait refuser par la validation.
            ...(form.legal_name.trim() === ''
              ? {}
              : { legal_name: form.legal_name.trim() }),
            ...(form.email.trim() === '' ? {} : { email: form.email.trim() }),
          } as never,
        }),
      ),
  })
}

/**
 * L'inscription d'une agence.
 *
 * **C'est la porte d'entrée du côté offre, et elle n'existait pas.** L'API
 * l'acceptait déjà — `POST /v1/agencies/register`, publique et fonctionnelle —
 * mais aucun client ne l'appelait. Une agence qui voulait rejoindre la plateforme
 * n'avait littéralement nulle part où le dire, et le seul chemin passait par une
 * commande `curl`.
 *
 * Deux temps, comme la connexion : le dossier, puis le code qui confirme le
 * numéro du responsable. Le second n'est pas une formalité — **c'est lui qui
 * crée la session**, et l'agence entre dans son espace immédiatement, sans
 * attendre l'admission. Elle peut donc déposer ses pièces et déclarer son parc
 * pendant que MOTOBOY instruit ; seule la publication des départs dans la
 * recherche attend l'admission.
 */
export function JoinPage() {
  const { t, i18n } = useTranslation()
  const me = useCurrentUser()
  const [form, setForm] = useState<Form>(EMPTY)
  const [code, setCode] = useState('')

  const register = useRegisterAgency(i18n.language)
  const verify = useVerifyOtp()

  // Une session ouverte n'a rien à faire ici : on est déjà entré.
  if (me.data) return <Navigate to={destinationFor(me.data.roles)} replace />

  const set = (key: keyof Form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const complete =
    form.name.trim() !== '' &&
    form.phone.trim() !== '' &&
    form.manager_first_name.trim() !== '' &&
    form.manager_last_name.trim() !== '' &&
    form.manager_phone.trim() !== ''

  const awaitingCode = register.isSuccess

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-ink-700 px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-neutral-0">
            <Logo variant="mark" size={26} />
            MOTOBOY
          </Link>
          <LocaleSwitch className="text-neutral-0" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-6">
        <form
          className="rounded-xl bg-neutral-0 p-6 shadow-sm sm:p-8"
          onSubmit={(event) => {
            event.preventDefault()

            if (awaitingCode) {
              verify.mutate({
                phone: form.manager_phone.trim(),
                code: code.trim(),
                purpose: 'REGISTRATION',
              })
            } else {
              register.mutate(form)
            }
          }}
        >
          <h1 className="text-2xl font-bold text-ink-700">
            {awaitingCode ? t('public:join.codeTitle') : t('public:join.title')}
          </h1>
          <p className="mt-1 mb-6 text-sm text-neutral-500">
            {awaitingCode ? t('public:join.codeSent') : t('public:join.lede')}
          </p>

          {register.error ? <ErrorNote message={describeError(register.error)} /> : null}
          {verify.error ? <ErrorNote message={describeError(verify.error)} /> : null}

          {awaitingCode ? (
            <div className="flex flex-col gap-4">
              <Field label={t('public:join.code')}>
                <input
                  className={INPUT}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  value={code}
                  // Un code n'est fait que de chiffres : filtrer à la saisie évite
                  // qu'un espace collé depuis un SMS fasse échouer un code juste.
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                />
              </Field>

              <p className="text-xs text-neutral-500">{t('public:join.afterwards')}</p>

              <Button
                type="submit"
                label={t('public:join.verify')}
                disabled={code.length < 4 || verify.isPending}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-bold text-ink-700">
                  {t('public:join.agencySection')}
                </h2>
                <Text
                  label={t('public:join.name')}
                  value={form.name}
                  onChange={set('name')}
                />
                <Text
                  label={t('public:join.legalName')}
                  value={form.legal_name}
                  onChange={set('legal_name')}
                />
                <Text
                  label={t('public:join.phone')}
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+237 6XX XX XX XX"
                />
                <Text
                  label={t('public:join.email')}
                  value={form.email}
                  onChange={set('email')}
                  type="email"
                />
              </section>

              <section className="flex flex-col gap-3 border-t border-neutral-200 pt-5">
                <h2 className="text-sm font-bold text-ink-700">
                  {t('public:join.managerSection')}
                </h2>
                {/*
                  Dit **avant** la saisie : ce numéro ne sert pas à vous joindre,
                  il devient un compte. Le découvrir après coup fait donner celui
                  de l'accueil, et personne ne peut plus entrer.
                */}
                <p className="text-xs text-neutral-500">
                  {t('public:join.managerNotice')}
                </p>
                <Text
                  label={t('public:join.managerFirstName')}
                  value={form.manager_first_name}
                  onChange={set('manager_first_name')}
                />
                <Text
                  label={t('public:join.managerLastName')}
                  value={form.manager_last_name}
                  onChange={set('manager_last_name')}
                />
                <Text
                  label={t('public:join.managerPhone')}
                  value={form.manager_phone}
                  onChange={set('manager_phone')}
                  placeholder="+237 6XX XX XX XX"
                />
              </section>

              <Button
                type="submit"
                label={t('public:join.submit')}
                disabled={!complete || register.isPending}
              />
            </div>
          )}
        </form>
      </main>
    </div>
  )
}

function Text({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string | undefined
}) {
  return (
    <Field label={label}>
      <input
        className={INPUT}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}
