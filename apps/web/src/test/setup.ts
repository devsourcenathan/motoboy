import { configure } from '@testing-library/dom'
/*
 * i18n initialisé pour les tests aussi : sans lui, `useTranslation` rend les
 * clés brutes et une assertion sur un texte visible échouerait en affichant
 * « public:search.submit », ce qui ne dit pas que la traduction manque mais que
 * l'initialisation manque.
 */
import { i18next } from '../lib/i18n'

/*
 * **La langue est fixée, pas devinée.** `initialLocale` interroge
 * `navigator.language`, qui vaut `en-US` sous jsdom : les tests écrits en
 * français se mettraient donc à échouer sur la machine du runner et à passer sur
 * celle du développeur, ou l'inverse. Un test dont le résultat dépend des
 * réglages de la machine ne prouve rien.
 *
 * Le français parce que c'est la langue de rédaction des tests existants ; ceux
 * qui éprouvent l'anglais changent de langue eux-mêmes.
 */
beforeEach(async () => {
  /*
   * **Attendu, et non lancé sans suite.** `changeLanguage` rend une promesse ;
   * la laisser courir fait atterrir le changement de langue au milieu du test
   * suivant, où il déclenche un rendu à un instant arbitraire. Le symptôme est
   * une poignée de tests qui passent seuls et échouent en suite — sans rapport
   * apparent avec la langue.
   */
  await i18next.changeLanguage('fr')
})

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

/*
 * **Cinq secondes au lieu d'une, et ce n'est pas masquer un défaut.**
 *
 * `findBy*` attend qu'un élément apparaisse ; son budget par défaut est d'une
 * seconde. Une requête qui n'aboutira jamais échoue de toute façon — le délai ne
 * change que le sort de celles qui aboutissent *tard*, sur une machine chargée.
 *
 * Le symptôme était net : deux tests passaient seuls et échouaient une fois sur
 * cinq en suite, sur des assertions correctes. Un test dont le verdict dépend de
 * la charge du runner apprend à relancer la CI jusqu'à ce qu'elle verdisse.
 */
configure({ asyncUtilTimeout: 5000 })
