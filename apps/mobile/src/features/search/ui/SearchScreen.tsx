import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { DEFAULT_TIMEZONE, formatDate } from '@motoboy/shared'
import {
  Button,
  Field,
  FieldGroup,
  fontSize,
  Screen,
  spacing,
  theme,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import {
  addDays,
  swap,
  todayInDisplayTimezone,
  validate,
  type CityChoice,
  type SearchForm,
} from '../model/searchForm'
import { CityPicker } from './CityPicker'

type Picking = 'from' | 'to' | null

/**
 * Recherche — premier écran du passager.
 *
 * Trois champs, et rien d'autre. Les filtres — prix, horaire, agence — vivent
 * sur les résultats : les demander avant d'avoir montré une offre ferait
 * renoncer quelqu'un qui veut simplement savoir s'il y a un car ce soir.
 *
 * Aucune authentification : c'est le premier écran, et il doit fonctionner
 * avant tout compte (§35 du brief).
 */
export function SearchScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const locale = useLocale()

  const [form, setForm] = useState<SearchForm>(() => ({
    from: null,
    to: null,
    date: todayInDisplayTimezone(DEFAULT_TIMEZONE),
  }))
  const [picking, setPicking] = useState<Picking>(null)
  const [showCalendar, setShowCalendar] = useState(false)

  const error = validate(form)
  const today = todayInDisplayTimezone(DEFAULT_TIMEZONE)

  function choose(city: CityChoice) {
    setForm((current) =>
      picking === 'from' ? { ...current, from: city } : { ...current, to: city },
    )
  }

  function submit() {
    if (error !== null || form.from === null || form.to === null) return

    router.push({
      pathname: '/results',
      params: {
        from: String(form.from.cityId),
        to: String(form.to.cityId),
        date: form.date,
        fromLabel: form.from.label,
        toLabel: form.to.label,
      },
    })
  }

  const dateLabel =
    form.date === today
      ? t('search.today')
      : form.date === addDays(today, 1)
        ? t('search.tomorrow')
        : formatDate(`${form.date}T00:00:00Z`, { locale })

  return (
    <Screen title={t('search.title')}>
      <View style={styles.body}>
        <FieldGroup>
          <Field
            label={t('search.from')}
            value={form.from?.label ?? null}
            placeholder={t('search.pickCity')}
            onPress={() => setPicking('from')}
          />
          <Field
            label={t('search.to')}
            value={form.to?.label ?? null}
            placeholder={t('search.pickCity')}
            onPress={() => setPicking('to')}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('search.swap')}
            onPress={() => setForm(swap)}
            style={styles.swap}
          >
            <Text style={styles.swapLabel}>↑↓ {t('search.swap')}</Text>
          </Pressable>

          <Field
            label={t('search.date')}
            value={dateLabel}
            placeholder={t('search.date')}
            onPress={() => setShowCalendar(true)}
          />
        </FieldGroup>

        {error === 'SAME_CITY' ? (
          <Text style={styles.error}>{t('search.sameCity')}</Text>
        ) : null}

        <Button label={t('search.submit')} onPress={submit} disabled={error !== null} />
      </View>

      <CityPicker
        visible={picking !== null}
        title={picking === 'from' ? t('search.from') : t('search.to')}
        onClose={() => setPicking(null)}
        onSelect={choose}
      />

      {showCalendar ? (
        <DateTimePicker
          value={new Date(`${form.date}T12:00:00Z`)}
          mode="date"
          // Chercher dans le passé n'a pas de sens : le départ serait déjà
          // parti, et la vente en ligne close.
          minimumDate={new Date(`${today}T00:00:00Z`)}
          onChange={(event, selected) => {
            // Sur Android le sélecteur est modal et se referme seul ; sur iOS
            // il reste monté, d'où la fermeture explicite dans les deux cas.
            if (Platform.OS !== 'ios') setShowCalendar(false)
            if (event.type === 'dismissed' || selected === undefined) {
              setShowCalendar(false)

              return
            }

            setForm((current) => ({
              ...current,
              date: selected.toISOString().slice(0, 10),
            }))
            if (Platform.OS === 'ios') setShowCalendar(false)
          }}
        />
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  swap: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  swapLabel: {
    fontSize: fontSize.sm,
    color: theme.text.brand,
    fontWeight: '600',
  },
  error: {
    fontSize: fontSize.sm,
    color: theme.text.danger,
  },
})
