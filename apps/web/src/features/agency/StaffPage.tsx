import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { unwrap } from '@motoboy/api-client'
import type { AgencyStaffMember } from '@motoboy/api-client/types'
import { api } from '../../lib/api'
import { describeError } from '../../lib/errors'
import {
  Button,
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  INPUT,
  PageHeader,
  SheetForm,
  SkeletonTable,
  Table,
} from '../../shared/ui'

/**
 * Ce que chaque profil peut faire, dit en clair.
 *
 * Une agence ne connaît pas `AGENT` ni `COUNTER` : elle connaît des gens qui
 * embarquent et des gens qui vendent. Afficher le nom technique du rôle ferait
 * choisir au hasard, et le mauvais choix donne le droit d'encaisser.
 */
const PROFILES = [
  { value: 'AGENT', key: 'agent' },
  { value: 'COUNTER', key: 'counter' },
] as const

const staffKey = ['agency', 'staff'] as const

/**
 * Le personnel de l'agence.
 *
 * **Deux profils, parce que vendre engage de l'argent.** Les fondre donnerait le
 * droit d'encaisser à quelqu'un dont ce n'est pas le travail ; l'alternative — le
 * rôle d'agence — lui ouvrirait aussi les reversements et cette page même.
 */
export function StaffPage() {
  const { t } = useTranslation()
  const staff = useQuery({
    queryKey: staffKey,
    queryFn: async ({ signal }) => unwrap(await api.GET('/v1/agency/staff', { signal })),
  })

  const [adding, setAdding] = useState(false)
  const rows = staff.data?.data ?? []

  return (
    <div>
      <PageHeader
        title={t('agency:staff.title')}
        subtitle={t('agency:staff.subtitle')}
        action={<Button label={t('agency:staff.add')} onPress={() => setAdding(true)} />}
      />

      {staff.isPending ? <SkeletonTable columns={4} /> : null}
      {staff.error ? <ErrorNote message={describeError(staff.error)} /> : null}

      {staff.data !== undefined && rows.length === 0 ? (
        <EmptyState
          title={t('agency:staff.emptyTitle')}
          body={t('agency:staff.emptyBody')}
          action={
            <Button label={t('agency:staff.add')} onPress={() => setAdding(true)} />
          }
        />
      ) : null}

      {rows.length === 0 ? null : (
        <Table
          head={[
            t('agency:staff.head.name'),
            t('agency:staff.head.phone'),
            t('agency:staff.head.role'),
            '',
          ]}
        >
          {rows.map((member) => (
            <StaffRow key={member.user_id} member={member} />
          ))}
        </Table>
      )}

      {adding ? <StaffPanel onClose={() => setAdding(false)} /> : null}
    </div>
  )
}

function StaffRow({ member }: { member: AgencyStaffMember }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const remove = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.DELETE('/v1/agency/staff/{user}', {
          params: { path: { user: member.user_id } },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: staffKey }),
  })

  const profile = PROFILES.find((entry) => entry.value === member.role)

  return (
    <tr>
      <Cell className="font-medium">
        {member.first_name} {member.last_name}
      </Cell>
      <Cell>{member.phone}</Cell>
      <Cell>
        {profile === undefined ? member.role : t(`agency:staff.roles.${profile.key}`)}
      </Cell>
      <Cell>
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2">
            {/*
              La conséquence est dite : le compte survit, seul l'accès à l'agence
              part. Sans cette phrase, une agence hésite à retirer quelqu'un de
              peur d'effacer ses ventes.
            */}
            <span className="text-xs text-neutral-500">
              {t('agency:staff.removeWarning')}
            </span>
            <Button
              label={t('agency:staff.confirm')}
              variant="danger"
              onPress={() => remove.mutate()}
              disabled={remove.isPending}
            />
            <button
              type="button"
              className="text-sm text-neutral-500"
              onClick={() => setConfirming(false)}
            >
              Annuler
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="text-sm font-medium text-danger hover:underline"
            onClick={() => setConfirming(true)}
          >
            {t('agency:staff.remove')}
          </button>
        )}

        {remove.error ? <ErrorNote message={describeError(remove.error)} /> : null}
      </Cell>
    </tr>
  )
}

function StaffPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'AGENT' | 'COUNTER'>('AGENT')

  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/agency/staff', {
          body: {
            phone: phone.trim(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            role,
          },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffKey })
      onClose()
    },
  })

  const chosen = PROFILES.find((entry) => entry.value === role)

  return (
    <SheetForm
      title={t('agency:staff.addTitle')}
      onClose={onClose}
      submitLabel={t('agency:staff.submit')}
      submitDisabled={phone.trim() === '' || firstName.trim() === ''}
      pending={add.isPending}
      error={add.error ? describeError(add.error) : undefined}
      onSubmit={() => {
        add.mutate()
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('agency:staff.firstName')}>
          <input
            className={INPUT}
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </Field>
        <Field label={t('agency:staff.lastName')}>
          <input
            className={INPUT}
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </Field>
      </div>

      <Field label={t('agency:staff.phone')} hint={t('agency:staff.phoneHint')}>
        <input
          className={INPUT}
          required
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+237 6XX XX XX XX"
        />
      </Field>

      {/*
        Le profil est expliqué sous le choix, pas seulement nommé : une agence
        ne connaît pas nos rôles, et le mauvais choix donne le droit d'encaisser.
      */}
      <Field
        label={t('agency:staff.role')}
        hint={
          chosen === undefined ? undefined : t(`agency:staff.roles.${chosen.key}Detail`)
        }
      >
        <select
          className={INPUT}
          value={role}
          onChange={(event) => setRole(event.target.value as typeof role)}
        >
          {PROFILES.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {t(`agency:staff.roles.${entry.key}`)}
            </option>
          ))}
        </select>
      </Field>
    </SheetForm>
  )
}
