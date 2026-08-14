import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import {
  fontSize,
  radius,
  spacing,
  TabIcon,
  theme,
  TOUCH_TARGET,
  type TabName,
} from '../../src/shared/ui'

/**
 * Les trois racines du parcours passager.
 *
 * **Accueil, ses billets, son profil.** Ce sont trois destinations, pas trois
 * étapes : un passager en gare ouvre l'application pour montrer son billet, pas
 * pour refaire une recherche. Les empiler dans une même pile obligeait à revenir
 * en arrière écran par écran — et rien n'indiquait que « Mes billets » existait.
 *
 * Le reste du parcours — résultats, départ, réservation, paiement — **passe
 * par-dessus** la barre plutôt qu'à l'intérieur. Pouvoir basculer d'onglet au
 * milieu d'un paiement laisserait une tenue de place courir pendant que le
 * passager consulte autre chose.
 */
export default function TabsLayout() {
  const { t } = useTranslation()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        // La pastille remplace l'étiquette et l'icône par défaut : le rendu
        // natif ne sait pas encadrer les deux ensemble.
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => (
            <Pill name="home" label={t('tabs.home')} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: t('tabs.tickets'),
          tabBarIcon: ({ focused }) => (
            <Pill name="tickets" label={t('tabs.tickets')} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabs.account'),
          tabBarIcon: ({ focused }) => (
            <Pill name="account" label={t('tabs.account')} focused={focused} />
          ),
        }}
      />
    </Tabs>
  )
}

/**
 * L'onglet courant est un **aplat bleu**, pas une teinte d'icône.
 *
 * Une simple couleur d'icône se perd sur une dalle bon marché en plein soleil,
 * précisément là où le produit s'utilise. La pastille reste lisible même quand
 * les couleurs délavent.
 */
function Pill({
  name,
  label,
  focused,
}: {
  name: TabName
  label: string
  focused: boolean
}) {
  return (
    <View style={[styles.pill, focused ? styles.pillActive : null]}>
      <TabIcon
        name={name}
        filled={focused}
        color={focused ? theme.text.inverse : theme.text.secondary}
      />
      <Text
        style={[styles.label, focused ? styles.labelActive : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: theme.surface.card,
    borderTopColor: theme.surface.border,
    height: TOUCH_TARGET + 32,
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
  },
  pill: {
    minWidth: 88,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
  },
  pillActive: {
    backgroundColor: theme.surface.brand,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: theme.text.secondary,
  },
  labelActive: {
    color: theme.text.inverse,
    fontWeight: '700',
  },
})
