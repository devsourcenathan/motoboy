import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Button, fontSize, radius, Screen, spacing, theme } from '../../../shared/ui'
import { useCurrentUser, useSignOut } from '../api/useAuth'

/**
 * Le compte.
 *
 * Sans session, l'écran **propose** de se connecter plutôt que d'y forcer : le
 * reste de l'application fonctionne sans compte, et transformer cet onglet en
 * mur donnerait le sentiment inverse.
 */
export function AccountScreen() {
  const { t } = useTranslation()
  const router = useRouter()

  const me = useCurrentUser()
  const signOut = useSignOut()

  if (me.isPending) {
    return (
      <Screen title={t('account.title')}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      </Screen>
    )
  }

  const user = me.data ?? null

  if (user === null) {
    return (
      <Screen title={t('account.title')}>
        <View style={styles.centered}>
          <Button
            label={t('account.signIn')}
            onPress={() => router.push('/account/sign-in')}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title={t('account.title')}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.name}>
            {user.first_name} {user.last_name}
          </Text>
          <Text style={styles.phone}>{user.phone}</Text>
        </View>

        <Button
          label={t('account.history')}
          onPress={() => router.push('/tickets')}
          variant="secondary"
        />

        <Button
          label={t('account.signOut')}
          onPress={() => signOut.mutate()}
          variant="ghost"
          busy={signOut.isPending}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    gap: spacing.xs / 2,
    padding: spacing.md,
    backgroundColor: theme.surface.raised,
    borderRadius: radius.lg,
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: theme.text.primary,
  },
  phone: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
  },
})
