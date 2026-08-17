import DateTimePicker from '@react-native-community/datetimepicker'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
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
  CheckIcon,
  Field,
  fontSize,
  HistoryIcon,
  lineHeight,
  PinIcon,
  radius,
  SearchIcon,
  sharedStyles,
  spacing,
  SwapIcon,
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

  /*
   * Relu **à chaque retour sur l'écran**, pas seulement au montage.
   *
   * L'accueil est une racine d'onglet : il reste monté pendant qu'on parcourt
   * les résultats. Avec un simple `useEffect([])`, la recherche qu'on vient de
   * lancer n'apparaissait jamais dans la liste — le bloc restait vide
   * indéfiniment.
   */
  useFocusEffect(
    useCallback(() => {
      let active = true

      void readRecentSearches().then((entries) => {
        if (active) setRecent(entries)
      })

      return () => {
        active = false
      }
    }, []),
  )

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
            Aucune bordure interne : la carte est **une seule surface**, et les
            filets suffisent à séparer. Encadrer chaque groupe ferait lire trois
            objets empilés là où il y en a un.

            Le bouton d'inversion se pose sur le filet, à cheval sur les deux
            villes qu'il échange.
          */}
          <View style={styles.cities}>
            <Field
              bare
              label={t('search.from')}
              value={form.from?.label ?? null}
              placeholder={t('search.fromExample')}
              icon={<PinIcon color={theme.text.muted} size={20} />}
              onPress={() => setPicking('from')}
            />

            <View style={styles.rule} />

            <Field
              bare
              label={t('search.to')}
              value={form.to?.label ?? null}
              placeholder={t('search.toExample')}
              icon={<PinIcon color={theme.text.muted} size={20} />}
              onPress={() => setPicking('to')}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('search.swap')}
              onPress={() => setForm(swap)}
              style={({ pressed }) => [styles.swap, pressed ? styles.swapPressed : null]}
            >
              <SwapIcon color={theme.text.ink} size={16} />
            </Pressable>
          </View>

          <View style={styles.rule} />

          <View style={styles.when}>
            <View style={styles.column}>
              <Field
                bare
                label={t('search.date')}
                value={dateLabel}
                placeholder={t('search.date')}
                onPress={() => setShowCalendar(true)}
              />
            </View>

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
          L'appel de service vit ici, sous la recherche, et non dans un
          cinquième onglet : c'est un besoin rare face à une recherche, et cinq
          onglets serrent la barre tout en mettant un usage occasionnel au rang
          du cœur du produit.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('serviceCall.entry')}
          onPress={() => router.push('/service-call')}
          style={({ pressed }) => [styles.call, pressed ? styles.callPressed : null]}
        >
          <View style={styles.callSeal}>
            <PinIcon color={theme.text.inverse} size={20} />
          </View>
          <View style={styles.callText}>
            <Text style={styles.callTitle}>{t('serviceCall.entry')}</Text>
            <Text style={styles.callBody}>{t('serviceCall.entryHint')}</Text>
          </View>
        </Pressable>

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
        {/*
          Ce que le produit promet, dit une fois sur l'écran d'accueil. La
          couverture sera faible au lancement : quelqu'un qui ouvre
          l'application sans rien y trouver doit au moins savoir à quoi elle
          sert.
        */}
        <View style={styles.promo}>
          <View style={styles.promoSeal}>
            <CheckIcon color={theme.text.inverse} size={22} />
          </View>
          <View style={styles.promoText}>
            <Text style={styles.promoTitle}>{t('search.promo.title')}</Text>
            <Text style={styles.promoBody}>{t('search.promo.body')}</Text>
          </View>
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
    // La photo a besoin de place pour se lire comme une image et non comme une
    // texture. Le texte se pose au milieu à gauche, pas en pied de bandeau.
    minHeight: 260,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
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
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '800',
    letterSpacing: 1,
    color: theme.text.inverse,
  },
  greeting: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: '600',
    color: theme.text.inverse,
    opacity: 0.9,
  },
  question: {
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight['2xl'],
    fontWeight: '700',
    letterSpacing: -0.5,
    color: theme.text.inverse,
  },
  card: {
    ...sharedStyles.card,
    borderRadius: radius.xl + 4,
    gap: spacing.base,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: -OVERLAP,
  },
  cities: {
    position: 'relative',
  },
  rule: {
    height: 1,
    backgroundColor: theme.surface.border,
  },
  when: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
  },
  swap: {
    position: 'absolute',
    right: 0,
    // Centré sur le filet qui sépare les deux villes.
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.raised,
  },
  swapPressed: {
    backgroundColor: theme.surface.inert,
  },
  /** Nu : la carte est une seule surface, le compteur n'a pas de cadre à lui. */
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    minHeight: TOUCH_TARGET + spacing.sm,
    paddingHorizontal: spacing.md,
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
  call: {
    ...sharedStyles.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  callPressed: {
    backgroundColor: theme.surface.raised,
  },
  callSeal: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.brand,
  },
  callText: {
    flex: 1,
    gap: 1,
  },
  callTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  callBody: {
    fontSize: fontSize.sm,
    color: theme.text.muted,
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
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: theme.surface.inkSoft,
  },
  promoSeal: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.ink,
  },
  promoText: {
    flex: 1,
    gap: 2,
  },
  promoTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.ink,
  },
  promoBody: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.text.secondary,
  },
})
