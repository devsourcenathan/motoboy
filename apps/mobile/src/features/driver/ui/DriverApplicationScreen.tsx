import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  Button,
  Field,
  fontSize,
  lineHeight,
  PinIcon,
  radius,
  Screen,
  sharedStyles,
  spacing,
  TextField,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'
import { useErrorMessage } from '../../../shared/i18n/useErrorMessage'
import { CityPicker } from '../../search/ui/CityPicker'
import type { CityChoice } from '../../search/model/searchForm'
import { useSubmitApplication } from '../api/useDriver'
import {
  emptyApplication,
  MAX_SEATS,
  validate,
  VEHICLE_TYPES,
  type DriverApplication,
  type VehicleType,
} from '../model/driverApplication'

/**
 * Déposer ou corriger son dossier (C2).
 *
 * **Le même écran pour les deux.** Le serveur accepte un nouveau dépôt sur un
 * dossier refusé, qui repart en examen ; distinguer « créer » et « modifier »
 * côté mobile inventerait une différence que l'API n'a pas.
 *
 * Le formulaire part vide même en correction : les champs sont peu nombreux, et
 * préremplir un dossier refusé invite à renvoyer tel quel ce qui vient d'être
 * refusé.
 */
export function DriverApplicationScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const describe = useErrorMessage()

  const [form, setForm] = useState<DriverApplication>(emptyApplication)
  const [picking, setPicking] = useState(false)

  const submit = useSubmitApplication()

  /*
   * La date du jour, prise une fois au montage. La relire à chaque frappe
   * ferait dépendre la validation de l'instant, et un formulaire rempli à
   * minuit changerait de verdict en cours de saisie.
   */
  const [today] = useState(() => new Date().toISOString().slice(0, 10))

  const error = validate(form, today)

  function send() {
    if (error !== null) return

    submit.mutate(form, { onSuccess: () => router.replace('/driver') })
  }

  return (
    <Screen title={t('driver.start')}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('driver.form.licence')}</Text>

            <TextField
              label={t('driver.form.licenceNumber')}
              value={form.licenceNumber}
              onChangeText={(licenceNumber) =>
                setForm((current) => ({ ...current, licenceNumber }))
              }
              autoCapitalize="characters"
              maxLength={64}
            />

            <View style={styles.rule} />

            <TextField
              label={t('driver.form.licenceExpiry')}
              hint="AAAA-MM-JJ"
              value={form.licenceExpiresAt}
              onChangeText={(licenceExpiresAt) =>
                setForm((current) => ({ ...current, licenceExpiresAt }))
              }
              error={error === 'EXPIRED_LICENCE' ? t('driver.form.expiredLicence') : null}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('driver.form.vehicle')}</Text>

            <TextField
              label={t('driver.form.plate')}
              value={form.plate}
              onChangeText={(plate) => setForm((current) => ({ ...current, plate }))}
              autoCapitalize="characters"
              maxLength={32}
            />

            <View style={styles.rule} />

            <View style={styles.types}>
              {VEHICLE_TYPES.map((type) => (
                <Choice
                  key={type}
                  label={type === 'CAR' ? t('driver.form.typeCar') : t('driver.form.typeBus')}
                  selected={form.vehicleType === type}
                  onPress={() => setForm((current) => ({ ...current, vehicleType: type }))}
                />
              ))}
            </View>

            <View style={styles.rule} />

            <TextField
              label={t('driver.form.model')}
              value={form.model}
              onChangeText={(model) => setForm((current) => ({ ...current, model }))}
              maxLength={120}
            />

            <View style={styles.rule} />

            <View style={styles.seats}>
              <View style={styles.seatsText}>
                <Text style={styles.seatsLabel}>{t('driver.form.seats')}</Text>
                <Text style={styles.seatsValue}>{form.seats}</Text>
              </View>
              <Step
                sign="−"
                disabled={form.seats <= 1}
                onPress={() => setForm((c) => ({ ...c, seats: c.seats - 1 }))}
              />
              <Step
                sign="+"
                disabled={form.seats >= MAX_SEATS}
                onPress={() => setForm((c) => ({ ...c, seats: c.seats + 1 }))}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Field
              bare
              label={t('driver.form.city')}
              value={form.city?.label ?? null}
              placeholder={t('search.pickCity')}
              icon={<PinIcon color={theme.route.origin} size={20} />}
              onPress={() => setPicking(true)}
            />
            {/*
              La ville n'est pas un détail administratif : c'est elle qui décide
              quelles demandes il verra. Le dire ici évite un dossier validé sur
              la mauvaise ville.
            */}
            <Text style={styles.hint}>{t('driver.form.cityHint')}</Text>
          </View>

          {submit.error ? (
            <Text style={styles.error}>{describe(submit.error)}</Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t('driver.form.submit')}
            onPress={send}
            disabled={error !== null}
            busy={submit.isPending}
          />
        </View>
      </KeyboardAvoidingView>

      <CityPicker
        visible={picking}
        title={t('driver.form.city')}
        onClose={() => setPicking(false)}
        onSelect={(city: CityChoice) => setForm((current) => ({ ...current, city }))}
      />
    </Screen>
  )
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.choice, selected ? styles.choiceOn : null]}
    >
      <Text style={[styles.choiceLabel, selected ? styles.choiceLabelOn : null]}>
        {label}
      </Text>
    </Pressable>
  )
}

function Step({
  sign,
  disabled,
  onPress,
}: {
  sign: string
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sign === '+' ? '+' : '-'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={spacing.base}
      style={[styles.step, disabled ? styles.stepOff : null]}
    >
      <Text style={styles.stepSign}>{sign}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    ...sharedStyles.card,
    gap: spacing.base,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.primary,
  },
  rule: {
    height: 1,
    backgroundColor: theme.surface.border,
  },
  types: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  choice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.surface.border,
  },
  choiceOn: {
    borderColor: 'transparent',
    backgroundColor: theme.surface.brandSoft,
  },
  choiceLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text.secondary,
  },
  choiceLabelOn: {
    color: theme.text.brand,
  },
  seats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    minHeight: TOUCH_TARGET,
  },
  seatsText: {
    flex: 1,
    gap: 1,
  },
  seatsLabel: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.text.muted,
  },
  seatsValue: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    fontWeight: '600',
    color: theme.text.primary,
  },
  step: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.brandSoft,
  },
  stepOff: {
    backgroundColor: theme.surface.inert,
  },
  stepSign: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: theme.text.brand,
  },
  hint: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.text.muted,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: theme.surface.card,
    borderTopWidth: 1,
    borderTopColor: theme.surface.border,
  },
  error: {
    fontSize: fontSize.sm,
    color: theme.text.danger,
  },
})
