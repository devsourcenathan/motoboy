import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { formatDate, formatMoney } from '@motoboy/shared'
import type { SearchSuggestions } from '@motoboy/api-client/types'
import {
  EmptyState,
  fontSize,
  radius,
  SearchIcon,
  spacing,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'

export interface EmptyResultsProps {
  suggestions: SearchSuggestions | undefined
  originLabel: string
  onPickDate: (date: string) => void
  onPickDestination: (cityId: number, label: string) => void
}

/**
 * Ce qui s'affiche quand la recherche ne renvoie rien.
 *
 * **Jamais une page vide.** La couverture sera faible au lancement, donc ce cas
 * sera fréquent — et un passager déçu deux fois ne revient pas. Le serveur
 * renvoie déjà, dans le même appel, les dates proches disponibles et les axes
 * desservis depuis la même ville : il y a donc toujours quelque chose à
 * proposer, sans aller-retour supplémentaire.
 */
export function EmptyResults({
  suggestions,
  originLabel,
  onPickDate,
  onPickDestination,
}: EmptyResultsProps) {
  const { t } = useTranslation()
  const locale = useLocale()

  const dates = suggestions?.nearby_dates ?? []
  const routes = suggestions?.routes_served ?? []

  return (
    /*
     * **Défilante.** C'était une `View` simple : dès que les suggestions
     * dépassaient la hauteur de l'écran, le bas devenait inatteignable — et rien
     * n'indiquait qu'il y avait un bas. Les dates proches sont précisément ce
     * qu'on vient chercher ici, et elles se trouvaient sous la ligne de flottaison.
     */
    <ScrollView
      contentContainerStyle={styles.container}
      // Le contenu tient parfois en entier : sans ça, l'indicateur de défilement
      // apparaîtrait sur un écran qui n'a rien à faire défiler.
      showsVerticalScrollIndicator={false}
    >
      <EmptyState
        icon={<SearchIcon color={theme.text.brand} size={28} />}
        title={t('results.empty.title')}
        body={t('results.empty.body')}
      />

      {dates.length === 0 ? null : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('results.empty.nearbyDates')}</Text>
          {dates.map((entry) => (
            <Pressable
              key={entry.date}
              accessibilityRole="button"
              onPress={() => onPickDate(entry.date)}
              style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
            >
              <Text style={styles.rowLabel}>
                {formatDate(`${entry.date}T00:00:00Z`, { locale })}
              </Text>
              <Text style={styles.rowMeta}>
                {t('results.empty.tripsCount', { count: entry.trips_count })} ·{' '}
                {t('results.empty.from', {
                  price: formatMoney(entry.lowest_price, locale),
                })}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {routes.length === 0 ? null : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('results.empty.otherRoutes', { city: originLabel })}
          </Text>
          {routes.map((route) => (
            <Pressable
              key={route.destination_city_id}
              accessibilityRole="button"
              onPress={() =>
                onPickDestination(route.destination_city_id, route.destination_city)
              }
              style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
            >
              <Text style={styles.rowLabel}>{route.destination_city}</Text>
              <Text style={styles.rowMeta}>
                {t('results.empty.tripsCount', { count: route.trips_count })}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: theme.text.primary,
  },
  body: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.muted,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  row: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: theme.surface.raised,
    borderRadius: radius.md,
  },
  rowPressed: {
    backgroundColor: theme.surface.brandSoft,
  },
  rowLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: theme.text.primary,
  },
  rowMeta: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
})
