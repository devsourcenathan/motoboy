import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  Button,
  Field,
  fontSize,
  KeyboardForm,
  lineHeight,
  PersonIcon,
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
import { useOpenServiceCall } from '../api/useServiceCall'
import {
  emptyServiceCall,
  MAX_TRAVELLERS,
  validate,
  type ServiceCallForm,
} from '../model/serviceCallForm'

type Picking = 'from' | 'to' | null

/**
 * Demander un véhicule (E1).
 *
 * **Position déclarée, pas captée** (E3) : une ville du référentiel et un point
 * de repère en texte libre. Le repère de départ est obligatoire — « Bafang » situe,
 * « carrefour Total » permet de se retrouver, et un chauffeur qui accepte sans
 * savoir où se rendre téléphonera, ce qui est précisément l'échange que la
 * demande évite.
 *
 * Le sélecteur de ville vient de la recherche : même référentiel, même geste. Le
 * dupliquer ferait diverger deux listes qui doivent rester identiques.
 */
export function ServiceCallScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const describe = useErrorMessage()

  const [form, setForm] = useState<ServiceCallForm>(emptyServiceCall)
  const [picking, setPicking] = useState<Picking>(null)

  const open = useOpenServiceCall()
  const error = validate(form)

  function choose(city: CityChoice) {
    setForm((current) =>
      picking === 'from' ? { ...current, from: city } : { ...current, to: city },
    )
  }

  function submit() {
    if (error !== null) return

    /*
     * `replace`, et non `push` : la demande est partie, et revenir en arrière sur
     * un formulaire déjà envoyé n'invite qu'à l'envoyer une seconde fois.
     */
    open.mutate(form, {
      onSuccess: (request) => router.replace(`/service-call/${request.reference}`),
    })
  }

  return (
    <Screen title={t('serviceCall.title')} subtitle={t('serviceCall.subtitle')}>
      <KeyboardForm
        contentContainerStyle={styles.content}
        footer={
          <Button
            label={t('serviceCall.submit')}
            onPress={submit}
            disabled={error !== null}
            busy={open.isPending}
          />
        }
      >
        <View style={styles.card}>
          <Field
            bare
            label={t('serviceCall.from')}
            value={form.from?.label ?? null}
            placeholder={t('search.pickCity')}
            icon={<PinIcon color={theme.route.origin} size={20} />}
            onPress={() => setPicking('from')}
          />

          <View style={styles.rule} />

          <TextField
            label={t('serviceCall.landmark')}
            hint={t('serviceCall.landmarkHint')}
            value={form.fromLandmark}
            onChangeText={(fromLandmark) =>
              setForm((current) => ({ ...current, fromLandmark }))
            }
            maxLength={160}
          />
        </View>

        <View style={styles.card}>
          <Field
            bare
            label={t('serviceCall.to')}
            value={form.to?.label ?? null}
            placeholder={t('search.pickCity')}
            icon={<PinIcon color={theme.route.destination} size={20} />}
            onPress={() => setPicking('to')}
          />

          <View style={styles.rule} />

          <TextField
            label={t('serviceCall.landmarkOptional')}
            value={form.toLandmark}
            onChangeText={(toLandmark) =>
              setForm((current) => ({ ...current, toLandmark }))
            }
            maxLength={160}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.travellers}>
            <PersonIcon color={theme.text.secondary} size={20} />
            <View style={styles.travellersText}>
              <Text style={styles.travellersLabel}>{t('serviceCall.passengers')}</Text>
              <Text style={styles.travellersValue}>{form.travellers}</Text>
            </View>
            <Step
              sign="−"
              disabled={form.travellers <= 1}
              onPress={() =>
                setForm((current) => ({ ...current, travellers: current.travellers - 1 }))
              }
            />
            <Step
              sign="+"
              disabled={form.travellers >= MAX_TRAVELLERS}
              onPress={() =>
                setForm((current) => ({ ...current, travellers: current.travellers + 1 }))
              }
            />
          </View>

          <View style={styles.rule} />

          <TextField
            label={t('serviceCall.note')}
            hint={t('serviceCall.noteHint')}
            value={form.note}
            onChangeText={(note) => setForm((current) => ({ ...current, note }))}
            multiline
            maxLength={500}
          />
        </View>

        {error === 'SAME_CITY' ? (
          <Text style={styles.error}>{t('serviceCall.sameCity')}</Text>
        ) : null}
        {error === 'MISSING_LANDMARK' ? (
          <Text style={styles.error}>{t('serviceCall.missingLandmark')}</Text>
        ) : null}
        {open.error ? <Text style={styles.error}>{describe(open.error)}</Text> : null}
      </KeyboardForm>

      <CityPicker
        visible={picking !== null}
        title={picking === 'from' ? t('serviceCall.from') : t('serviceCall.to')}
        onClose={() => setPicking(null)}
        onSelect={choose}
      />
    </Screen>
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
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    ...sharedStyles.card,
    gap: spacing.base,
    padding: spacing.md,
  },
  rule: {
    height: 1,
    backgroundColor: theme.surface.border,
  },
  travellers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    minHeight: TOUCH_TARGET,
  },
  travellersText: {
    flex: 1,
    gap: 1,
  },
  travellersLabel: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.text.muted,
  },
  travellersValue: {
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
  error: {
    fontSize: fontSize.sm,
    color: theme.text.danger,
  },
})
