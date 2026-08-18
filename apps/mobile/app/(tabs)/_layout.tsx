import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { fontSize, spacing, TabIcon, theme, TOUCH_TARGET, type TabName } from '../../src/shared/ui'

/**
 * Les trois racines du parcours passager.
 *
 * **Accueil, ses voyages, ses billets, son profil.** Ce sont quatre
 * destinations, pas quatre étapes : un passager en gare ouvre l'application pour
 * montrer son billet, pas pour refaire une recherche.
 *
 * Voyages et billets sont **séparés à dessein** : une réservation de trois
 * places donne trois billets. La réservation porte le paiement et l'annulation,
 * le billet porte le code qu'on présente. Les fondre en un seul onglet
 * obligerait à choisir laquelle des deux questions on n'a pas le droit de
 * poser.
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
        name="trips"
        options={{
          title: t('tabs.trips'),
          tabBarIcon: ({ focused }) => (
            <Pill name="trips" label={t('tabs.trips')} focused={focused} />
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
 * L'onglet courant se marque en **orange, glyphe plein**.
 *
 * La couleur seule se perd sur une dalle bon marché en plein soleil ; le
 * remplissage du glyphe la double, si bien que la position reste lisible même
 * quand les teintes délavent.
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
    <View style={styles.pill}>
      <TabIcon
        name={name}
        filled={focused}
        color={focused ? theme.text.brand : theme.text.muted}
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
    minWidth: 72,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: theme.text.muted,
  },
  labelActive: {
    color: theme.text.brand,
    fontWeight: '700',
  },
})
