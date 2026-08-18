import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { session } from '../lib/api'

/**
 * Ce que chaque test du back-office trouve en arrivant.
 *
 * **`fetch` est remplacé, jamais réel.** Un test qui atteint le réseau ne teste
 * plus l'écran mais la disponibilité d'un serveur — et il échouerait sur la
 * machine de quelqu'un d'autre, à un autre moment, pour une raison sans rapport.
 */
/**
 * Un stockage local en mémoire.
 *
 * **jsdom n'en installe pas ici**, quelle que soit l'origine configurée : le
 * global existe mais n'est qu'un objet nu, et le premier `clear()` échoue sur
 * « localStorage.clear is not a function » — une erreur qui ne désigne pas sa
 * cause. Plutôt que de contourner au cas par cas, on en fournit un vrai.
 *
 * C'est aussi le meilleur comportement pour un test : ce coffre-ci ne dépend
 * d'aucune particularité d'environnement, et le client d'API n'a besoin que de
 * ces quatre opérations.
 */
function memoryStorage(): Storage {
  let entries = new Map<string, string>()

  return {
    get length() {
      return entries.size
    },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, String(value)),
    removeItem: (key) => void entries.delete(key),
    clear: () => {
      entries = new Map()
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())

  /*
   * Neuf à chaque test : une session laissée par le précédent déciderait du
   * suivant — le genre de dépendance à l'ordre qui ne se voit qu'une fois la
   * suite réordonnée.
   */
  vi.stubGlobal('localStorage', memoryStorage())

  /*
   * **La session est un singleton de module qui met son jeton en cache.**
   * Vider `localStorage` ne suffit donc pas : le premier test fige l'état de
   * tous les suivants — celui qui s'exécute sans session ferait échouer ceux qui
   * en posent une, pour une raison invisible dans leur code.
   *
   * Ce cache est correct en production, où la session ne change pas sous les
   * pieds de l'application. C'est au test de repartir de zéro.
   */
  session.expire()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
