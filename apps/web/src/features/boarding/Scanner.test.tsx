import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '../../test/render'
import { Scanner } from './Scanner'

/**
 * Le lecteur de QR, sur le quai.
 *
 * **Ce qui compte n'est pas qu'il lise, c'est qu'il échoue proprement.** La
 * caméra manque, ou son autorisation est refusée, et l'agent a cinquante
 * personnes devant lui : un composant muet le laisserait attendre une image qui
 * ne viendra pas, alors que la saisie manuelle existe à côté.
 *
 * **Le cas nominal n'est pas testé ici, et c'est délibéré.** L'exercer sous jsdom
 * demande de simuler `getUserMedia`, `HTMLMediaElement.play` et `BarcodeDetector`
 * — trois absences de l'environnement. À ce compte-là le test n'éprouve plus le
 * composant mais les simulacres qu'on lui a écrits. La lecture d'un QR se vérifie
 * sur un téléphone, pas ici.
 */

function refuseCamera(reason: string): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => Promise.reject(new Error(reason))) },
  })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices')
  vi.restoreAllMocks()
})

describe('Scanner', () => {
  /**
   * **Le test qui compte.** Une caméra refusée doit renvoyer vers la saisie
   * manuelle, pas laisser un cadre noir. C'est la seule issue quand l'agent est
   * pressé et que rien ne s'affiche.
   */
  it('renvoie vers la saisie manuelle quand la caméra est refusée', async () => {
    refuseCamera('NotAllowedError')

    render(<Scanner onScan={vi.fn()} />)

    expect(
      await screen.findByText(/Caméra indisponible. Saisissez la référence à la main./),
    ).toBeInTheDocument()
  })

  /**
   * Un appareil sans `mediaDevices` — un vieux navigateur, ou une page servie
   * hors HTTPS — n'a pas d'erreur à intercepter : l'appel lui-même lève. Le
   * message doit être le même, sinon ce cas-là passe en silence.
   */
  it('dit la même chose quand l’appareil n’a pas de caméra du tout', async () => {
    Reflect.deleteProperty(navigator, 'mediaDevices')

    render(<Scanner onScan={vi.fn()} />)

    expect(await screen.findByText(/Caméra indisponible/)).toBeInTheDocument()
  })
})
