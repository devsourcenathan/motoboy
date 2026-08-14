import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { formatCountdown, type Countdown } from '@motoboy/shared'
import { fontSize, lineHeight, radius, spacing, theme, TimerIcon } from '../ui'

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
      <TimerIcon color={expired ? theme.text.muted : theme.text.onDangerSoft} />

      <Text style={[styles.title, expired ? styles.titleExpired : null]}>
        {expired ? t('booking.held.expired') : t('booking.held.title')}
      </Text>

      {expired ? null : (
        <Text style={styles.time}>{formatCountdown(countdown)}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  /*
   * Fond d'alerte et non teinte de marque : ce bandeau annonce une perte
   * imminente, pas une information. C'est la seule chose à l'écran qui ait le
   * droit d'être rouge.
   */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    padding: spacing.sm,
    backgroundColor: theme.surface.dangerSoft,
    borderRadius: radius.md,
  },
  expired: {
    backgroundColor: theme.surface.inert,
  },
  title: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text.onDangerSoft,
  },
  titleExpired: {
    color: theme.text.secondary,
  },
  time: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '800',
    color: theme.text.onDangerSoft,
    fontVariant: ['tabular-nums'],
  },
})
