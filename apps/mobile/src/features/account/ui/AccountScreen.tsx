import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  Button,
  ChevronIcon,
  fontSize,
  HistoryIcon,
  lineHeight,
  PersonIcon,
  radius,
  Screen,
  sharedStyles,
  spacing,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
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
  const locale = useLocale()

  const me = useCurrentUser()
  const signOut = useSignOut()

  if (me.isPending) {
    return (
      <Screen title={t('account.title')}>
        <View style={sharedStyles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      </Screen>
    )
  }

  const user = me.data ?? null

  if (user === null) {
    return (
      <Screen title={t('account.title')}>
        <View style={sharedStyles.centered}>
          <Text style={styles.invite}>{t('account.whyNeeded')}</Text>
          <Button
            label={t('account.signIn')}
            onPress={() => router.push('/account/sign-in')}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          {/*
            Initiales et non photographie : aucun endroit du produit ne permet
            d'en téléverser une, et un emplacement vide dirait qu'il en manque
            une.
          */}
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>
              {`${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()}
            </Text>
          </View>

          <Text style={styles.name} accessibilityRole="header">
            {user.first_name} {user.last_name}
          </Text>
          <Text style={styles.contact}>{user.phone}</Text>
          {user.email === null || user.email === undefined ? null : (
            <Text style={styles.contact}>{user.email}</Text>
          )}
        </View>

        {/*
          La langue est **affichée, pas réglée**. Un sélecteur ici demanderait
          de persister le choix et de le pousser sur le profil : sans cela il
          repartirait à zéro au prochain démarrage, ce qui est pire qu'un
          réglage absent.
        */}
        <View style={styles.tile}>
          <View style={styles.tileTop}>
            <View style={styles.tileIcon}>
              <PersonIcon color={theme.text.brand} size={22} />
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{locale === 'fr' ? 'FR' : 'EN'}</Text>
            </View>
          </View>
          <Text style={styles.tileTitle}>{t('account.language')}</Text>
          <Text style={styles.tileBody}>{t('account.languageName')}</Text>
        </View>

        <View style={styles.menu}>
          <MenuRow
            icon={<HistoryIcon color={theme.text.brand} size={22} />}
            title={t('account.history')}
            hint={t('account.historyHint')}
            onPress={() => router.push('/tickets')}
          />
        </View>

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

function MenuRow({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <ChevronIcon color={theme.text.muted} size={20} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  invite: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  identity: {
    ...sharedStyles.card,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: theme.surface.brand,
    backgroundColor: theme.surface.brandSoft,
    marginBottom: spacing.base,
  },
  avatarLabel: {
    fontSize: fontSize['2xl'],
    fontWeight: '800',
    color: theme.text.brand,
  },
  name: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '700',
    color: theme.text.primary,
  },
  contact: {
    fontSize: fontSize.sm,
    color: theme.text.secondary,
  },
  tile: {
    ...sharedStyles.card,
    gap: spacing.xs,
    padding: spacing.md,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: theme.surface.brandSoft,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: theme.surface.brand,
  },
  chipLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: theme.text.inverse,
  },
  tileTitle: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  tileBody: {
    fontSize: fontSize.sm,
    color: theme.text.secondary,
  },
  menu: {
    ...sharedStyles.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET + spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    backgroundColor: theme.surface.raised,
  },
  rowIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.brandSoft,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  rowHint: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
})
