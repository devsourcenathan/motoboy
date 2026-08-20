import { describe, expect, it } from 'vitest'
import type { BoardingList } from '@motoboy/api-client/types'
import {
  acknowledge,
  enqueue,
  readList,
  readQueue,
  referenceFrom,
  storeList,
} from './offline'

/**
 * La mémoire de l'appareil pendant l'embarquement.
 *
 * **C'est la partie où une erreur ne se voit pas.** Une validation perdue, c'est
 * un passager embarqué que personne ne compte ; une file mal purgée, c'est le
 * même billet renvoyé indéfiniment. Rien de tout cela ne se remarque sur le quai.
 */
const list = (references: string[]): BoardingList =>
  ({
    trip: { reference: 'TR-001' },
    generated_at: '2026-08-18T06:00:00Z',
    passengers: references.map((reference) => ({
      ticket_reference: reference,
      passenger_name: 'Awa Nkeng',
      status: 'VALID',
    })),
  }) as unknown as BoardingList

const pending = (clientId: string, ticket: string) => ({
  client_id: clientId,
  ticket_reference: ticket,
  validated_at: '2026-08-18T07:00:00Z',
  method: 'SCAN' as const,
})

describe('referenceFrom', () => {
  /**
   * Le QR porte `MTB1:<référence>:<signature>`. **La signature n'est pas
   * vérifiée ici** : la vérifier exigerait de distribuer la clé sur chaque
   * téléphone d'agent. C'est l'appartenance à la liste qui fait foi.
   */
  it('extrait la référence du format de QR', () => {
    expect(referenceFrom('MTB1:TCK-ABC123:9f2b7c')).toBe('TCK-ABC123')
  })

  /** La saisie manuelle passe par le même chemin : l'agent tape la référence seule. */
  it('accepte une référence nue', () => {
    expect(referenceFrom('tck-abc123')).toBe('TCK-ABC123')
  })

  it('rejette une charge vide ou tronquée', () => {
    expect(referenceFrom('  ')).toBeNull()
    expect(referenceFrom('MTB1:')).toBeNull()
  })
})

describe('la liste locale', () => {
  /**
   * **Une liste d'un autre départ est pire qu'aucune** : elle ferait accepter un
   * billet valide, mais pour un autre car.
   */
  it('ignore une liste appartenant à un autre départ', () => {
    storeList('TR-001', list(['TCK-1']))

    expect(readList('TR-002')).toBeNull()
    expect(readList('TR-001')?.list.passengers).toHaveLength(1)
  })
})

describe('la file de validations', () => {
  it('retient ce qui est validé hors ligne', () => {
    enqueue(pending('c1', 'TCK-1'))
    enqueue(pending('c2', 'TCK-2'))

    expect(readQueue().map((entry) => entry.ticket_reference)).toEqual(['TCK-1', 'TCK-2'])
  })

  /**
   * Un double scan de l'agent n'est pas un doublon à signaler : le même billet
   * n'entre qu'une fois.
   */
  it('n’empile pas deux fois le même billet', () => {
    enqueue(pending('c1', 'TCK-1'))
    enqueue(pending('c2', 'TCK-1'))

    expect(readQueue()).toHaveLength(1)
  })

  /**
   * **Purge par `client_id`, jamais par billet.** C'est l'identifiant que la
   * réponse renvoie tel quel ; purger par billet effacerait une validation faite
   * entre-temps, qui ne serait donc jamais envoyée.
   */
  it('ne retire que ce que le serveur a acquitté', () => {
    enqueue(pending('c1', 'TCK-1'))
    enqueue(pending('c2', 'TCK-2'))

    const left = acknowledge(['c1'])

    expect(left.map((entry) => entry.client_id)).toEqual(['c2'])
  })

  it('survit à un stockage corrompu plutôt que de faire échouer l’embarquement', () => {
    localStorage.setItem('motoboy.boarding.queue', '{ ceci n’est pas du JSON')

    expect(readQueue()).toEqual([])
  })
})
