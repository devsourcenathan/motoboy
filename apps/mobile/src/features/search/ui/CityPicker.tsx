import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { PlaceSuggestion } from '@motoboy/api-client/types'
import {
  EmptyState,
  fontSize,
  PinIcon,
  radius,
  SkeletonList,
  spacing,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { MIN_QUERY_LENGTH, usePlaceSuggestions } from '../api/usePlaceSuggestions'
import { toCityChoice, type CityChoice } from '../model/searchForm'

export interface CityPickerProps {
  visible: boolean
  title: string
  onClose: () => void
  onSelect: (city: CityChoice) => void
}

/**
 * Choix d'une ville, par recherche.
 *
 * En plein écran plutôt qu'en liste déroulante : le clavier occupe la moitié
 * d'un téléphone, et une liste coincée dans ce qui reste n'affiche que deux
 * résultats.
 */
export function CityPicker({ visible, title, onClose, onSelect }: CityPickerProps) {
  const { t } = useTranslation()
  const describe = useErrorMessage()
  const [query, setQuery] = useState('')
  const { suggestions, isFetching, error, refetch } = usePlaceSuggestions(query)

  /*
   * Plus de branche « tapez davantage » : le serveur rend les villes les plus
   * utiles quand rien n'est saisi. Le sélecteur s'ouvrait auparavant sur une
   * liste vide et une consigne — exact, et inutilisable pour qui ne sait pas
   * encore ce que la plateforme dessert.
   */
  const searching = query.trim().length >= MIN_QUERY_LENGTH

  function choose(suggestion: PlaceSuggestion) {
    onSelect(toCityChoice(suggestion))
    setQuery('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={styles.closeLabel}>{t('action.close', { ns: 'common' })}</Text>
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.searchCity')}
          placeholderTextColor={theme.text.muted}
          style={styles.input}
          autoFocus
          autoCorrect={false}
          // Les accents ne se saisissent pratiquement jamais sur un clavier de
          // téléphone : la comparaison est insensible aux accents côté serveur,
          // et la correction automatique ne ferait qu'ajouter du bruit (B1).
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel={t('search.searchCity')}
        />

        <FlatList
          data={suggestions}
          keyExtractor={(item) => `${item.type}-${item.station_id ?? item.city_id}`}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              {/*
                Quatre états, et **aucun silencieux**. Une panne de réseau
                donnait jusqu'ici le même écran blanc qu'une saisie trop courte :
                impossible de savoir s'il fallait taper plus ou réessayer.
              */}
              {isFetching ? (
                <SkeletonList count={8} />
              ) : error ? (
                <EmptyState
                  tone="problem"
                  icon={<PinIcon color={theme.text.danger} size={28} />}
                  title={describe(error)}
                  action={{
                    label: t('action.retry', { ns: 'common' }),
                    onPress: () => void refetch(),
                  }}
                />
              ) : (
                <EmptyState
                  icon={<PinIcon color={theme.text.brand} size={28} />}
                  title={t('search.noCity')}
                  body={searching ? t('search.noCityBody') : undefined}
                />
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => choose(item)}
              style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
            >
              <Text style={styles.rowLabel}>{item.label}</Text>
              {/*
                Une gare affiche sa ville de rattachement : c'est elle qui sera
                cherchée, et la taire laisserait croire que la recherche se
                limite à cette gare.
              */}
              {item.secondary_label === null ||
              item.secondary_label === undefined ? null : (
                <Text style={styles.rowSecondary}>{item.secondary_label}</Text>
              )}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.surface.page,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: theme.text.primary,
  },
  close: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  closeLabel: {
    fontSize: fontSize.base,
    color: theme.text.brand,
  },
  input: {
    minHeight: TOUCH_TARGET,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.lg,
    color: theme.text.primary,
    backgroundColor: theme.surface.raised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  row: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    backgroundColor: theme.surface.brandSoft,
  },
  rowLabel: {
    fontSize: fontSize.lg,
    color: theme.text.primary,
  },
  rowSecondary: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
  },
  empty: {
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  emptyLabel: {
    fontSize: fontSize.base,
    color: theme.text.muted,
    textAlign: 'center',
  },
})
