import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Le lecteur de QR, quand l'appareil sait le faire.
 *
 * **`BarcodeDetector` plutôt qu'une bibliothèque.** Il est natif sur Chrome
 * Android — le terminal réel des agents — et ne coûte rien au paquet. Une
 * bibliothèque de décodage pèse plusieurs centaines de kilo-octets, qu'il
 * faudrait télécharger sur la connexion même dont on cherche à se passer.
 *
 * Là où il manque — iOS, navigateurs anciens —, le composant ne s'affiche pas et
 * la saisie manuelle prend le relais. **Elle n'est pas un dépannage** : sur un
 * quai, un QR froissé ou un écran cassé arrivent, et un embarquement qui exige la
 * caméra bloque le passager qui a payé.
 */
interface Detector {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}

export function Scanner({ onScan }: { onScan: (payload: string) => void }) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  /*
   * **L'état retient ce qui s'est passé, pas comment le dire.**
   *
   * Traduire dans l'effet obligerait à y faire entrer `t`, dont l'identité change
   * à chaque bascule de langue : la caméra redémarrerait alors sous les doigts de
   * l'agent. L'omettre laisserait au contraire le message figé dans l'ancienne
   * langue. Un drapeau traduit au rendu échappe aux deux.
   */
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopped = false

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // La caméra arrière : celle de face filmerait l'agent.
          video: { facingMode: 'environment' },
        })

        const video = videoRef.current

        if (video === null) return

        video.srcObject = stream
        await video.play()

        const Detector = (
          globalThis as unknown as {
            BarcodeDetector: new (options: { formats: string[] }) => Detector
          }
        ).BarcodeDetector

        const detector = new Detector({ formats: ['qr_code'] })

        /*
         * Une lecture toutes les 300 ms plutôt qu'à chaque image : détecter à
         * 60 Hz chauffe le téléphone et vide la batterie, sur un appareil qui doit
         * tenir toute une journée d'embarquements.
         */
        const tick = async () => {
          if (stopped || videoRef.current === null) return

          try {
            const found = await detector.detect(videoRef.current)

            if (found[0] !== undefined) onScan(found[0].rawValue)
          } catch {
            // Une image illisible n'est pas une panne : on réessaie à la suivante.
          }

          if (!stopped) globalThis.setTimeout(() => void tick(), 300)
        }

        void tick()
      } catch {
        setFailed(true)
      }
    }

    void start()

    return () => {
      stopped = true
      // La caméra se relâche au démontage : la laisser allumée garde la diode
      // active et fait croire à l'agent qu'on le filme.
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onScan])

  if (failed) {
    return (
      <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500">
        {t('boarding:cameraUnavailable')}
      </p>
    )
  }

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      className="aspect-square w-full rounded-xl bg-ink-900 object-cover"
    />
  )
}
