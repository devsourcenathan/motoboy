import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { ApiError, NetworkError } from '@motoboy/api-client'
import { errorLabel } from '@motoboy/shared'
import { Button, fontSize, Screen, spacing, theme } from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import { useTripSearch } from '../api/useTripSearch'
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
  }>()

  const from = Number(params.from)
  const to = Number(params.to)
  const criteria =
    Number.isFinite(from) && Number.isFinite(to) && params.date
      ? { from, to, date: params.date }
      : null

  const { trips, suggestions, isPending, error, refetch } = useTripSearch(criteria)

  return (
    <Screen title={t('results.title', { from: params.fromLabel, to: params.toLabel })}>
      {isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.text.brand} />
        </View>
      ) : error ? (
        <SearchError error={error} onRetry={() => void refetch()} locale={locale} />
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
function SearchError({
  error,
  onRetry,
  locale,
}: {
  error: unknown
  onRetry: () => void
  locale: ReturnType<typeof useLocale>
}) {
  const { t } = useTranslation()

  const message =
    error instanceof ApiError
      ? errorLabel(error.code, locale)
      : error instanceof NetworkError
        ? t('state.offline', { ns: 'common' })
        : t('state.unexpected', { ns: 'common' })

  return (
    <View style={styles.centered}>
      <Text style={styles.error}>{message}</Text>
      <Button
        label={t('action.retry', { ns: 'common' })}
        onPress={onRetry}
        variant="secondary"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  error: {
    fontSize: fontSize.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
})
