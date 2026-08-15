import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { formatDate } from '@motoboy/shared'
import {
  Button,
  fontSize,
  lineHeight,
  radius,
  RouteDot,
  Screen,
  spacing,
  theme,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { SEARCH_SORTS, useTripSearch, type SearchSort } from '../api/useTripSearch'
import { EmptyResults } from './EmptyResults'
import { TripCard } from './TripCard'

/**
 * Résultats d'une recherche.
 *
 * Les critères arrivent par l'URL plutôt que par un état partagé : un résultat
 * doit être partageable et rouvrable depuis un lien profond, et un état en
 * mémoire disparaîtrait au premier retour arrière.
 */
export function ResultsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const locale = useLocale()
  const params = useLocalSearchParams<{
    from: string
    to: string
    date: string
    fromLabel: string
    toLabel: string
    passengers?: string
  }>()

  const [sort, setSort] = useState<SearchSort>('best')

  const from = Number(params.from)
  const to = Number(params.to)
  const criteria =
    Number.isFinite(from) && Number.isFinite(to) && params.date
      ? { from, to, date: params.date, sort }
      : null

  const { trips, suggestions, isPending, error, refetch } = useTripSearch(criteria)
  const passengers = Number(params.passengers ?? 1) || 1

  return (
    <Screen title={t('results.title')}>
      {/*
        Le trajet cherché reste sous les yeux : sans lui, on ne sait plus quelle
        recherche on regarde après deux retours arrière.
      */}
      <View style={styles.summary}>
        <View style={styles.summaryRoute}>
          <RouteDot color={theme.route.origin} size={10} />
          <Text style={styles.summaryCity} numberOfLines={1}>
            {params.fromLabel}
          </Text>
          <Text style={styles.summaryArrow}>→</Text>
          <Text style={styles.summaryCity} numberOfLines={1}>
            {params.toLabel}
          </Text>
          <RouteDot color={theme.route.destination} size={10} />
        </View>
        <Text style={styles.summaryMeta}>
          {t('results.summary', {
            date: params.date ? formatDate(`${params.date}T00:00:00Z`, { locale }) : '',
            count: passengers,
          })}
        </Text>
      </View>

      {/*
        Quatre ordres, tous portés par le contrat : la puce change réellement la
        requête, elle ne réordonne pas une liste déjà reçue.
      */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {SEARCH_SORTS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: sort === option }}
            onPress={() => setSort(option)}
            style={[styles.chip, sort === option ? styles.chipActive : null]}
          >
            <Text
              style={[styles.chipLabel, sort === option ? styles.chipLabelActive : null]}
            >
              {t(`results.sort.${option}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      ) : error ? (
        <SearchError error={error} onRetry={() => void refetch()} />
      ) : trips.length === 0 ? (
        <EmptyResults
          suggestions={suggestions}
          originLabel={params.fromLabel ?? ''}
          onPickDate={(date) => router.setParams({ date })}
          onPickDestination={(cityId, label) =>
            router.setParams({ to: String(cityId), toLabel: label })
          }
        />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(trip) => trip.reference}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              onPress={() => router.push(`/trip/${item.reference}`)}
            />
          )}
        />
      )}
    </Screen>
  )
}

/**
 * Une erreur se lit, elle ne se devine pas.
 *
 * « Pas de réseau » et « le serveur a refusé » appellent deux réactions
 * opposées : réessayer, ou corriger la demande. Le texte affiché vient du
 * **code** de l'erreur, jamais de son message — celui-ci est un diagnostic
 * destiné aux journaux (I10).
 */
function SearchError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  const describe = useErrorMessage()

  return (
    <View style={styles.centered}>
      <Text style={styles.error}>{describe(error)}</Text>
      <Button
        label={t('action.retry', { ns: 'common' })}
        onPress={onRetry}
        variant="secondary"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.base,
  },
  summaryRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  summaryCity: {
    flexShrink: 1,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '700',
    color: theme.text.primary,
  },
  summaryArrow: {
    fontSize: fontSize.base,
    color: theme.text.muted,
  },
  summaryMeta: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  chips: {
    gap: spacing.base,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  chip: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: theme.surface.border,
    backgroundColor: theme.surface.card,
  },
  chipActive: {
    backgroundColor: theme.surface.brand,
    borderColor: theme.surface.brand,
  },
  chipLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text.secondary,
  },
  chipLabelActive: {
    color: theme.text.inverse,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  error: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
})
