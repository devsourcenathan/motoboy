import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { DEFAULT_TIMEZONE, formatDate } from '@motoboy/shared'
import {
  Button,
  CalendarIcon,
  Field,
  fontSize,
  HistoryIcon,
  lineHeight,
  PersonIcon,
  PinIcon,
  radius,
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
  readRecentSearches,
  rememberSearch,
  type RecentSearch,
} from '../model/recentSearches'
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
 *
 * Le bandeau marine porte la marque, la carte blanche **chevauche son bord** :
 * le formulaire est ainsi la première chose que l'œil rencontre en descendant,
 * avant même d'avoir lu le titre.
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
  const [recent, setRecent] = useState<readonly RecentSearch[]>([])

  useEffect(() => {
    let active = true

    void readRecentSearches().then((entries) => {
      if (active) setRecent(entries)
    })

    return () => {
      active = false
    }
  }, [])

  const error = validate(form)
  const today = todayInDisplayTimezone(DEFAULT_TIMEZONE)

  function choose(city: CityChoice) {
    setForm((current) =>
      picking === 'from' ? { ...current, from: city } : { ...current, to: city },
    )
  }

  function run(search: SearchForm) {
    if (search.from === null || search.to === null) return

    // Mémorisé avant de naviguer : au retour, l'écran se remonte et relit la
    // liste, qui doit déjà contenir la recherche qu'on vient de lancer.
    void rememberSearch({
      from: search.from,
      to: search.to,
      date: search.date,
      passengers: search.passengers,
    })

    router.push({
      pathname: '/results',
      params: {
        from: String(search.from.cityId),
        to: String(search.to.cityId),
        date: search.date,
        fromLabel: search.from.label,
        toLabel: search.to.label,
        passengers: String(search.passengers),
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
    <SafeAreaView style={sharedStyles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        {/*
          Photo de gare routière sous un voile marine. Le voile n'est pas
          décoratif : sans lui, le texte blanc passe sur un ciel clair et
          disparaît — et c'est justement dehors, en plein jour, que cet écran
          s'ouvre.
        */}
        <ImageBackground
          source={require('../../../../assets/home.jpg')}
          style={styles.hero}
          imageStyle={styles.heroImage}
          accessible={false}
        >
          <View style={styles.veil} />
          <Text style={styles.wordmark}>MOTOBOY</Text>
          <Text style={styles.greeting}>{t('search.greeting')}</Text>
          <Text style={styles.question} accessibilityRole="header">
            {t('search.title')}
          </Text>
        </ImageBackground>

        <View style={styles.card}>
          {/*
            Un seul panneau pour les deux villes, séparées d'un filet : elles
            forment une paire — c'est un trajet, pas deux réglages
            indépendants. Le bouton d'inversion se pose sur le filet, à cheval
            sur ce qu'il échange.
          */}
          <View style={styles.panel}>
            <Field
              bare
              label={t('search.from')}
              value={form.from?.label ?? null}
              placeholder={t('search.fromExample')}
              icon={<TargetIcon color={theme.route.origin} />}
              onPress={() => setPicking('from')}
            />

            <View style={styles.rule} />

            <Field
              bare
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
              <SwapIcon color={theme.text.ink} size={18} />
            </Pressable>
          </View>

          {/* Quand et combien : deux colonnes d'un même panneau. */}
          <View style={[styles.panel, styles.panelRow]}>
            <View style={styles.column}>
              <Field
                bare
                label={t('search.date')}
                value={dateLabel}
                placeholder={t('search.date')}
                icon={<CalendarIcon color={theme.text.secondary} size={18} />}
                onPress={() => setShowCalendar(true)}
              />
            </View>

            <View style={styles.columnRule} />

            <View style={styles.column}>
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
            onPress={() => run(form)}
            disabled={error !== null}
            icon={<SearchIcon color={theme.text.inverse} size={20} />}
          />
        </View>

        {/*
          Les recherches récentes ne sont pas de la décoration : un passager fait
          souvent l'aller puis le retour du même trajet, et les retaper de zéro
          est le geste que cet écran doit éviter.
        */}
        {recent.length === 0 ? null : (
          <View style={styles.recent}>
            <Text style={styles.recentTitle}>{t('search.recent')}</Text>

            <View style={styles.recentList}>
              {recent.map((entry) => (
                <Pressable
                  key={`${entry.from.cityId}-${entry.to.cityId}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.from.label} → ${entry.to.label}`}
                  // La date mémorisée peut être passée : on relance sur le
                  // trajet, à la date du jour, plutôt que sur un départ parti.
                  onPress={() =>
                    run({
                      from: entry.from,
                      to: entry.to,
                      date: entry.date < today ? today : entry.date,
                      passengers: entry.passengers,
                    })
                  }
                  style={({ pressed }) => [
                    styles.recentRow,
                    pressed ? styles.recentRowPressed : null,
                  ]}
                >
                  <View style={styles.recentIcon}>
                    <HistoryIcon color={theme.text.muted} size={18} />
                  </View>
                  <View style={styles.recentText}>
                    <Text style={styles.recentRoute} numberOfLines={1}>
                      {entry.from.label} → {entry.to.label}
                    </Text>
                    <Text style={styles.recentMeta}>
                      {formatDate(`${entry.date}T00:00:00Z`, { locale })} ·{' '}
                      {t('search.passengers')} {entry.passengers}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}
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
    </SafeAreaView>
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
      <PersonIcon color={theme.text.secondary} size={18} />

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

/** Ce que la carte blanche mord sur le bandeau, en points. */
const OVERLAP = spacing.lg

const styles = StyleSheet.create({
  page: {
    paddingBottom: spacing.xl,
  },
  hero: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg + OVERLAP,
    // Repli si l'image tarde ou manque : le texte blanc reste lisible.
    backgroundColor: theme.surface.ink,
    overflow: 'hidden',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroImage: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  veil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 33, 56, 0.66)',
  },
  wordmark: {
    alignSelf: 'center',
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '800',
    letterSpacing: 1,
    color: theme.text.inverse,
    marginBottom: spacing.sm,
  },
  greeting: {
    fontSize: fontSize.base,
    color: theme.text.inverse,
    opacity: 0.85,
  },
  question: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '700',
    color: theme.text.inverse,
  },
  card: {
    ...sharedStyles.card,
    gap: spacing.sm,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: -OVERLAP,
  },
  /** Un cadre unique, des filets à l'intérieur : une paire, pas deux réglages. */
  panel: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rule: {
    height: 1,
    marginLeft: spacing.md + 24 + spacing.sm,
    backgroundColor: theme.surface.border,
  },
  column: {
    flex: 1,
  },
  columnRule: {
    width: 1,
    marginVertical: spacing.base,
    backgroundColor: theme.surface.border,
  },
  swap: {
    position: 'absolute',
    right: spacing.base,
    // Centré sur le filet qui sépare les deux villes.
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
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
  /** Nu : le panneau porte déjà le cadre. */
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    minHeight: TOUCH_TARGET + spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
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
  recent: {
    gap: spacing.base,
    padding: spacing.md,
  },
  recentTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  recentList: {
    ...sharedStyles.card,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
  },
  recentRowPressed: {
    backgroundColor: theme.surface.raised,
  },
  recentIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.raised,
  },
  recentText: {
    flex: 1,
    gap: 1,
  },
  recentRoute: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  recentMeta: {
    fontSize: fontSize.xs,
    color: theme.text.muted,
  },
})
