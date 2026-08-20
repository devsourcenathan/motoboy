import { describe, expect, it } from 'vitest'
import { destinationFor, PUBLIC_HOME, spaceLabel } from './destination'

/**
 * Où atterrit un compte une fois connecté.
 *
 * **Le défaut qui a motivé ce fichier** : le formulaire ne redirigeait nulle
 * part. On saisissait son code, on restait là — authentifié, sans que rien ne le
 * dise et sans nulle part où aller. Il fallait connaître l'URL de son espace par
 * cœur, ce qui n'est demandable à personne.
 */
describe('destinationFor', () => {
  it('mène chaque rôle à son espace', () => {
    expect(destinationFor(['ADMIN'])).toBe('/admin')
    expect(destinationFor(['AGENCY'])).toBe('/agency/departures')
    expect(destinationFor(['AGENT'])).toBe('/boarding')
    expect(destinationFor(['OWNER'])).toBe('/owner')
  })

  /**
   * **Le privilège le plus large gagne.** Un gérant d'agence qui embarque aussi
   * sur le quai porte les deux rôles : l'envoyer vers le plus restreint lui
   * cacherait la moitié de son travail, et il n'aurait aucun moyen de deviner que
   * l'autre moitié existe.
   */
  it('choisit le plus large quand un compte porte deux rôles', () => {
    expect(destinationFor(['AGENT', 'AGENCY'])).toBe('/agency/departures')
    expect(destinationFor(['AGENCY', 'ADMIN'])).toBe('/admin')
  })

  /**
   * Un passager n'a pas d'espace professionnel : il reste sur le comparateur
   * plutôt que d'atterrir sur un « accès refusé » qu'il n'a pas provoqué.
   */
  it('laisse un passager sur le comparateur', () => {
    expect(destinationFor(['PASSENGER'])).toBe(PUBLIC_HOME)
    expect(destinationFor(undefined)).toBe(PUBLIC_HOME)
    expect(destinationFor([])).toBe(PUBLIC_HOME)
  })
})

/**
 * Le refus nommait toujours « l'administration », quel que soit l'espace. Un
 * gérant d'agence refusé sur le quai lisait donc une phrase sans rapport, et
 * repartait chercher un tort qu'il n'avait pas.
 */
describe('spaceLabel', () => {
  it('nomme l’espace réellement refusé', () => {
    expect(spaceLabel('/agency/money')).toMatch(/agence/)
    expect(spaceLabel('/boarding')).toMatch(/embarquement/)
    expect(spaceLabel('/admin/payouts')).toMatch(/administration/)
    expect(spaceLabel('/owner')).toMatch(/propriétaire/)
  })
})
