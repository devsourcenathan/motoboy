import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Button,
  CheckIcon,
  fontSize,
  lineHeight,
  radius,
  sharedStyles,
  spacing,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'
import {
  NO_FILTERS,
  PERIODS,
  PRICE_BRACKETS,
  type Period,
  type PriceBracket,
  type SearchFilters,
} from '../api/useTripSearch'

export interface AgencyOption {
  readonly id: number
  readonly name: string
}

export interface FilterSheetProps {
  visible: boolean
  /** Les agences qui desservent réellement cette liaison, ce jour-là. */
  agencies: readonly AgencyOption[]
  value: SearchFilters
  onClose: () => void
  onApply: (filters: SearchFilters) => void
}

const VEHICLES = ['BUS', 'CAR'] as const

/**
 * Les filtres de la liste de résultats.
 *
 * **Tout est appliqué par le serveur.** Filtrer côté téléphone ne porterait que
 * sur la page reçue, et donnerait un résultat faux dès qu'il y en a plusieurs.
 *
 * Les agences proposées sont celles qui **desservent cette liaison** : une
 * liste figée ferait cocher des transporteurs qui ne passent pas par là.
 *
 * Prix et horaires se choisissent par tranches, pas au curseur : personne ne
 * cherche « entre 4 200 et 7 850 », et deux poignées se ratent au pouce.
 */
export function FilterSheet({
  visible,
  agencies,
  value,
  onClose,
  onApply,
}: FilterSheetProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<SearchFilters>(value)

  // Le brouillon repart de l'état appliqué à chaque ouverture : fermer sans
  // valider ne doit rien changer.
  useEffect(() => {
    if (visible) setDraft(value)
  }, [visible, value])

  function toggleAgency(id: number) {
    setDraft((current) => ({
      ...current,
      agencyIds: current.agencyIds.includes(id)
        ? current.agencyIds.filter((entry) => entry !== id)
        : [...current.agencyIds, id],
    }))
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {t('results.filters.title')}
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={styles.closeLabel}>{t('action.close', { ns: 'common' })}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {agencies.length === 0 ? null : (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>{t('results.filters.agencies')}</Text>
              <View style={styles.card}>
                {agencies.map((agency) => (
                  <Choice
                    key={agency.id}
                    label={agency.name}
                    checked={draft.agencyIds.includes(agency.id)}
                    onPress={() => toggleAgency(agency.id)}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('results.filters.price')}</Text>
            <View style={styles.card}>
              {(Object.keys(PRICE_BRACKETS) as PriceBracket[]).map((bracket) => (
                <Choice
                  key={bracket}
                  label={t(`results.filters.bracket.${bracket}`)}
                  checked={draft.price === bracket}
                  onPress={() => setDraft((current) => ({ ...current, price: bracket }))}
                />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('results.filters.departure')}</Text>
            <View style={styles.card}>
              {(Object.keys(PERIODS) as Period[]).map((period) => (
                <Choice
                  key={period}
                  label={t(`results.filters.period.${period}`)}
                  checked={draft.period === period}
                  onPress={() => setDraft((current) => ({ ...current, period }))}
                />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('results.filters.vehicle')}</Text>
            <View style={styles.card}>
              <Choice
                label={t('results.filters.any')}
                checked={draft.vehicleType === null}
                onPress={() => setDraft((current) => ({ ...current, vehicleType: null }))}
              />
              {VEHICLES.map((vehicle) => (
                <Choice
                  key={vehicle}
                  label={t(`results.vehicle.${vehicle}`)}
                  checked={draft.vehicleType === vehicle}
                  onPress={() =>
                    setDraft((current) => ({ ...current, vehicleType: vehicle }))
                  }
                />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <View style={styles.card}>
              <Choice
                label={t('results.filters.onlyAvailable')}
                checked={draft.onlyAvailable}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    onlyAvailable: !current.onlyAvailable,
                  }))
                }
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            style={styles.footerButton}
            label={t('results.filters.reset')}
            variant="secondary"
            onPress={() => setDraft(NO_FILTERS)}
          />
          <Button
            style={styles.footerButton}
            label={t('results.filters.apply')}
            onPress={() => onApply(draft)}
          />
        </View>
      </SafeAreaView>
    </Modal>
  )
}

function Choice({
  label,
  checked,
  onPress,
}: {
  label: string
  checked: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed ? styles.choicePressed : null]}
    >
      {/*
        Une case cochée, pas seulement une teinte : le choix doit rester lisible
        pour qui ne distingue pas l'orange du gris.
      */}
      <View style={[styles.box, checked ? styles.boxChecked : null]}>
        {checked ? <CheckIcon color={theme.text.inverse} size={14} /> : null}
      </View>
      <Text style={styles.choiceLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
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
    fontWeight: '600',
    color: theme.text.brand,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  group: {
    gap: spacing.base,
  },
  groupTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  card: {
    ...sharedStyles.card,
    overflow: 'hidden',
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.base,
  },
  choicePressed: {
    backgroundColor: theme.surface.raised,
  },
  box: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: theme.surface.border,
  },
  boxChecked: {
    backgroundColor: theme.surface.brand,
    borderColor: theme.surface.brand,
  },
  choiceLabel: {
    flex: 1,
    fontSize: fontSize.base,
    color: theme.text.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: theme.surface.card,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  footerButton: {
    flex: 1,
  },
})
