import { StyleSheet, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { colors, radius, spacing } from '../../../shared/ui'

export interface TicketQrProps {
  /** Contenu à encoder, tel que renvoyé par l'API. */
  payload: string
  /** Atténué quand le billet n'est plus valable. */
  dimmed?: boolean
}

/**
 * Côté du code, en points.
 *
 * Assez grand pour être lu par un lecteur tenu à bout de bras, dans une gare
 * où l'éclairage n'est pas garanti. Un QR trop petit oblige l'agent à
 * s'approcher, et la file s'allonge.
 */
const QR_SIZE = 220

/**
 * Le QR Code du billet, **dessiné sur l'appareil**.
 *
 * Il est regénéré à partir de `qr_payload`, jamais téléchargé comme image :
 * un billet dont le code dépend du réseau ne s'affiche pas au moment précis où
 * il n'y en a pas — en gare, devant l'agent (I5).
 *
 * Fond blanc et marge explicites : un lecteur a besoin du contraste et de la
 * zone de silence autour du motif, quel que soit le thème de l'application.
 */
export function TicketQr({ payload, dimmed = false }: TicketQrProps) {
  return (
    <View
      style={[styles.frame, dimmed ? styles.dimmed : null]}
      // Le code n'est pas lisible par une synthèse vocale : ce qui compte pour
      // qui ne voit pas, c'est de savoir qu'il est là et affiché.
      accessible
      accessibilityRole="image"
    >
      <QRCode value={payload} size={QR_SIZE} backgroundColor={colors.neutral[0]} />
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    padding: spacing.md,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
  },
  dimmed: {
    opacity: 0.35,
  },
})
