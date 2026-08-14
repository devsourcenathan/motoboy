import { useEffect, useState } from 'react'
import { countdownTo, type Countdown } from '@motoboy/shared'

/**
 * Compte à rebours de la tenue des places.
 *
 * **Le passager doit savoir qu'il est chronométré.** Sans ce compteur, il ne
 * comprend pas pourquoi sa place lui échappe pendant qu'il cherche son
 * téléphone pour payer — et il conclut à une panne, pas à un délai (B2).
 *
 * Purement affichage : **l'expiration fait foi côté serveur**. Un client qui
 * voit zéro doit redemander l'état, jamais conclure seul que les places sont
 * perdues — l'horloge d'un téléphone se règle à la main.
 */
export function useHoldCountdown(expiresAt: string | null | undefined): Countdown | null {
  const [countdown, setCountdown] = useState<Countdown | null>(() =>
    expiresAt ? countdownTo(expiresAt) : null,
  )

  useEffect(() => {
    if (!expiresAt) {
      setCountdown(null)

      return
    }

    setCountdown(countdownTo(expiresAt))

    const timer = setInterval(() => {
      const next = countdownTo(expiresAt)

      setCountdown(next)

      // Rien à décompter au-delà de zéro : laisser l'intervalle tourner
      // maintiendrait le composant éveillé pour rien, sur un téléphone dont la
      // batterie compte.
      if (next.expired) clearInterval(timer)
    }, 1000)

    return () => clearInterval(timer)
  }, [expiresAt])

  return countdown
}
