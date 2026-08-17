import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { formatMoney } from '@motoboy/shared'
import {
  Button,
  CheckIcon,
  fontSize,
  lineHeight,
  radius,
  Screen,
  sharedStyles,
  spacing,
  TextField,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import {
  useEarnings,
  usePayoutAccounts,
  useSubmitPayoutAccount,
  type Earnings,
} from '../api/useEarnings'

const OPERATORS = ['MTN', 'ORANGE'] as const

/**
 * Son argent, et où le verser (C8, C9).
 *
 * **Deux nombres en tête, pas un.** Le solde est ce qui lui est dû ; le
 * reversable est ce qui peut partir aujourd'hui. Une course terminée il y a une
 * heure compte dans le premier et pas dans le second, et n'afficher que le solde
 * ferait attendre un virement impossible — puis appeler le support.
 *
 * Le compte de versement vit sur le même écran : c'est la seule action que cet
 * argent appelle, et la seule chose qui, non faite, empêche tout virement.
 */
export function DriverEarningsScreen() {
  const { t } = useTranslation()
  const locale = useLocale()
  const describe = useErrorMessage()

  const earnings = useEarnings()
  const accounts = usePayoutAccounts()

  if (earnings.isPending) {
    return (
      <Screen title={t('driver.earnings')}>
        <View style={sharedStyles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      </Screen>
    )
  }

  if (earnings.data === undefined) {
    return (
      <Screen title={t('driver.earnings')}>
        <View style={sharedStyles.centered}>
          <Text style={styles.body}>{describe(earnings.error)}</Text>
          <Button
            label={t('action.retry', { ns: 'common' })}
            variant="secondary"
            onPress={() => void earnings.refetch()}
          />
        </View>
      </Screen>
    )
  }

  const data: Earnings = earnings.data
  const account = (accounts.data?.data ?? []).at(0) ?? null
  const belowMinimum = data.payable.amount > 0 && data.payable.amount < data.minimum.amount

  return (
    <Screen title={t('driver.earnings')}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={earnings.isFetching}
            onRefresh={() => void earnings.refetch()}
            tintColor={theme.text.brand}
          />
        }
      >
        <View style={styles.card}>
          <Text style={styles.label}>{t('driver.balance')}</Text>
          <Text style={styles.balance}>{formatMoney(data.balance, locale)}</Text>
          <Text style={styles.hint}>{t('driver.balanceHint')}</Text>

          <View style={styles.rule} />

          <Text style={styles.label}>{t('driver.payable')}</Text>
          <Text style={styles.payable}>{formatMoney(data.payable, locale)}</Text>
          <Text style={styles.hint}>
            {t('driver.payableHint', { hours: data.delay_hours })}
          </Text>

          {/*
            Le seuil n'est dit que lorsqu'il retient effectivement quelque chose.
            L'annoncer toujours ferait lire une condition à quelqu'un dont l'argent
            part déjà.
          */}
          {belowMinimum ? (
            <Text style={styles.hint}>
              {t('driver.belowMinimum', { amount: formatMoney(data.minimum, locale) })}
            </Text>
          ) : null}
        </View>

        <PayoutAccountCard account={account} />

        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t('driver.history')}</Text>
          {data.entries.length === 0 ? (
            <Text style={styles.body}>{t('driver.historyEmpty')}</Text>
          ) : (
            data.entries.map((entry, index) => (
              <View key={`${entry.occurred_at ?? ''}-${index}`} style={styles.row}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {entry.description ?? entry.type}
                </Text>
                {/*
                  Le signe est porté par la couleur autant que par le nombre : un
                  prélèvement lu comme un gain est la réclamation la plus prévisible.
                */}
                <Text
                  style={[
                    styles.rowAmount,
                    entry.amount.amount < 0 ? styles.rowAmountDebit : null,
                  ]}
                >
                  {formatMoney(entry.amount, locale)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t('driver.payouts')}</Text>
          {data.payouts.length === 0 ? (
            <Text style={styles.body}>{t('driver.payoutsEmpty')}</Text>
          ) : (
            data.payouts.map((payout) => (
              <View key={payout.reference} style={styles.row}>
                <Text style={styles.rowLabel}>{payout.reference}</Text>
                <Text style={styles.rowAmount}>
                  {formatMoney(payout.net_amount, locale)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  )
}

/**
 * Le compte de versement, déclaré puis vérifié.
 *
 * L'état « en cours de vérification » est affiché parce qu'il bloque réellement :
 * un chauffeur qui a saisi son numéro et ne voit rien partir conclurait à une
 * panne.
 */
function PayoutAccountCard({
  account,
}: {
  account: { operator?: string | null; masked_number: string; verified: boolean } | null
}) {
  const { t } = useTranslation()
  const describe = useErrorMessage()

  const [editing, setEditing] = useState(account === null)
  const [operator, setOperator] = useState<(typeof OPERATORS)[number]>('MTN')
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')

  const submit = useSubmitPayoutAccount()
  const complete = number.trim() !== '' && name.trim() !== ''

  if (!editing && account !== null) {
    return (
      <View style={styles.card}>
        <Text style={styles.groupTitle}>{t('driver.account')}</Text>

        <View style={styles.accountHead}>
          {account.verified ? <CheckIcon color={theme.text.success} size={18} /> : null}
          <Text style={styles.accountState}>
            {account.verified ? t('driver.accountVerified') : t('driver.accountPending')}
          </Text>
        </View>

        <Text style={styles.accountNumber}>
          {[account.operator, account.masked_number].filter(Boolean).join(' · ')}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('driver.accountReplace')}
          onPress={() => setEditing(true)}
          style={styles.link}
        >
          <Text style={styles.linkLabel}>{t('driver.accountReplace')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.groupTitle}>{t('driver.account')}</Text>
      <Text style={styles.hint}>{t('driver.accountNone')}</Text>

      <Text style={styles.label}>{t('driver.accountOperator')}</Text>
      <View style={styles.operators}>
        {OPERATORS.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: operator === value }}
            accessibilityLabel={value}
            onPress={() => setOperator(value)}
            style={[styles.choice, operator === value ? styles.choiceOn : null]}
          >
            <Text
              style={[styles.choiceLabel, operator === value ? styles.choiceLabelOn : null]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextField
        label={t('driver.accountNumber')}
        hint={t('driver.accountNumberHint')}
        value={number}
        onChangeText={setNumber}
        keyboardType="phone-pad"
        maxLength={50}
      />

      <TextField
        label={t('driver.accountName')}
        hint={t('driver.accountNameHint')}
        value={name}
        onChangeText={setName}
        maxLength={150}
      />

      {submit.error ? <Text style={styles.error}>{describe(submit.error)}</Text> : null}

      <Button
        label={t('driver.accountSubmit')}
        disabled={!complete}
        busy={submit.isPending}
        onPress={() =>
          submit.mutate(
            { operator, number, name },
            {
              onSuccess: () => {
                setEditing(false)
                setNumber('')
                setName('')
              },
            },
          )
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    ...sharedStyles.card,
    gap: spacing.base,
    padding: spacing.md,
  },
  label: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: '700',
    color: theme.text.muted,
    textTransform: 'uppercase',
  },
  balance: {
    fontSize: fontSize['2xl'],
    fontWeight: '800',
    color: theme.text.primary,
  },
  payable: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.success,
  },
  hint: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.text.muted,
  },
  rule: {
    height: 1,
    backgroundColor: theme.surface.border,
  },
  group: {
    gap: spacing.base,
  },
  groupTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  row: {
    ...sharedStyles.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  rowLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    color: theme.text.secondary,
  },
  rowAmount: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.success,
  },
  rowAmountDebit: {
    color: theme.text.danger,
  },
  accountHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  accountState: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.secondary,
  },
  accountNumber: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  operators: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  choice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  choiceOn: {
    borderColor: 'transparent',
    backgroundColor: theme.surface.brandSoft,
  },
  choiceLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text.secondary,
  },
  choiceLabelOn: {
    color: theme.text.brand,
  },
  link: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
  },
  linkLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.brand,
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.secondary,
  },
  error: {
    fontSize: fontSize.sm,
    color: theme.text.danger,
  },
})
