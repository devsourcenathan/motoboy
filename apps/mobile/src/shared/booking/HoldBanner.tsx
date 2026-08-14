import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { formatCountdown, type Countdown } from '@motoboy/shared'
import { fontSize, radius, spacing, theme } from '../ui'

export interface HoldBannerProps {
  countdown: Countdown | null
}

/**
 * Le temps qu'il reste pour payer.
 *
 * **Visible en permanence**, pas caché derrière un avertissement qu'on ferme :
 * un passager qui cherche son téléphone pour saisir son code Mobile Money doit
 * voir combien de temps il lui reste, sinon la perte de sa place ressemble à
 * une panne (B2).
 *
 * Dans `shared/` parce que la réservation et le paiement l'affichent tous deux.
 */
export function HoldBanner({ countdown }: HoldBannerProps) {
  const { t } = useTranslation()

  if (countdown === null) return null

  const expired = countdown.expired

  return (
    <View
      style={[styles.banner, expired ? styles.expired : null]}
      // Annoncé quand il change d'état, pas à chaque seconde : un lecteur
      // d'écran qui égrènerait le décompte rendrait l'écran inutilisable.
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={styles.title}>{t('booking.held.title')}</Text>
      <Text style={expired ? styles.expiredText : styles.time}>
        {expired
          ? t('booking.held.expired')
          : t('booking.held.body', { time: formatCountdown(countdown) })}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    gap: spacing.xs / 2,
    padding: spacing.md,
    backgroundColor: theme.surface.brandSoft,
    borderRadius: radius.md,
  },
  expired: {
    backgroundColor: theme.surface.raised,
  },
  title: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: theme.text.muted,
    textTransform: 'uppercase',
  },
  time: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text.brand,
  },
  expiredText: {
    fontSize: fontSize.base,
    color: theme.text.danger,
  },
})
