import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { DEFAULT_TIMEZONE, formatDate } from '@motoboy/shared'
import {
  Button,
  CalendarIcon,
  Field,
  fontSize,
  lineHeight,
  PersonIcon,
  PinIcon,
  radius,
  Screen,
  SearchIcon,
  sharedStyles,
  spacing,
  SwapIcon,
  TargetIcon,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'
import { useLocale } from '../../../shared/i18n/useLocale'
import {
  addDays,
  MAX_PASSENGERS,
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
    passengers: 1,
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
        passengers: String(form.passengers),
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
    <Screen title={t('search.title')} subtitle={t('search.subtitle')}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          {/*
            Le bouton d'inversion chevauche les deux champs qu'il échange : posé
            à côté, il faudrait lire son étiquette pour comprendre sur quoi il
            porte.
          */}
          <View style={styles.pair}>
            <Field
              label={t('search.from')}
              value={form.from?.label ?? null}
              placeholder={t('search.fromExample')}
              icon={<TargetIcon color={theme.route.origin} />}
              onPress={() => setPicking('from')}
            />
            <Field
              label={t('search.to')}
              value={form.to?.label ?? null}
              placeholder={t('search.toExample')}
              icon={<PinIcon color={theme.route.destination} />}
              onPress={() => setPicking('to')}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('search.swap')}
              onPress={() => setForm(swap)}
              style={({ pressed }) => [styles.swap, pressed ? styles.swapPressed : null]}
            >
              <SwapIcon color={theme.text.brand} />
            </Pressable>
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <Field
                label={t('search.date')}
                value={dateLabel}
                placeholder={t('search.date')}
                icon={<CalendarIcon color={theme.text.secondary} />}
                onPress={() => setShowCalendar(true)}
              />
            </View>
            <View style={styles.half}>
              <PassengerStepper
                label={t('search.passengers')}
                value={form.passengers}
                onChange={(passengers) => setForm((current) => ({ ...current, passengers }))}
              />
            </View>
          </View>

          {error === 'SAME_CITY' ? (
            <Text style={styles.error}>{t('search.sameCity')}</Text>
          ) : null}

          <Button
            label={t('search.submit')}
            onPress={submit}
            disabled={error !== null}
            icon={<SearchIcon color={theme.text.inverse} size={20} />}
          />
        </View>
      </ScrollView>

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

/**
 * Le nombre de voyageurs.
 *
 * Deux boutons plutôt qu'un sélecteur : la valeur va de 1 à une poignée, et
 * ouvrir une liste modale pour passer de 1 à 2 coûte deux gestes de plus que
 * le problème n'en vaut.
 */
function PassengerStepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <View style={styles.stepper} accessible accessibilityLabel={`${label}, ${value}`}>
      <PersonIcon color={theme.text.secondary} />

      <View style={styles.stepperText}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <Text style={styles.stepperValue}>{value}</Text>
      </View>

      <View style={styles.stepperButtons}>
        <StepButton
          sign="−"
          hint={label}
          disabled={value <= 1}
          onPress={() => onChange(value - 1)}
        />
        <StepButton
          sign="+"
          hint={label}
          disabled={value >= MAX_PASSENGERS}
          onPress={() => onChange(value + 1)}
        />
      </View>
    </View>
  )
}

function StepButton({
  sign,
  hint,
  disabled,
  onPress,
}: {
  sign: string
  hint: string
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sign === '+' ? '+' : '-'} ${hint}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={spacing.base}
      style={[styles.step, disabled ? styles.stepDisabled : null]}
    >
      <Text style={styles.stepSign}>{sign}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    ...sharedStyles.card,
    gap: spacing.sm,
    padding: spacing.md,
  },
  pair: {
    gap: spacing.sm,
  },
  swap: {
    position: 'absolute',
    right: -spacing.base,
    // Centré sur la couture entre les deux champs.
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  swapPressed: {
    backgroundColor: theme.surface.raised,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    minHeight: TOUCH_TARGET + spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    backgroundColor: theme.surface.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  stepperText: {
    flex: 1,
    gap: 1,
  },
  stepperLabel: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.text.muted,
  },
  stepperValue: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: '600',
    color: theme.text.primary,
  },
  stepperButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  step: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.brandSoft,
  },
  stepDisabled: {
    backgroundColor: theme.surface.inert,
  },
  stepSign: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: '700',
    color: theme.text.brand,
  },
  error: {
    fontSize: fontSize.sm,
    color: theme.text.danger,
  },
})
