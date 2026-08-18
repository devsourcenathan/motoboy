import type { BoardingList } from '@motoboy/api-client/types'

/**
 * Ce que l'appareil garde quand le réseau n'est plus là.
 *
 * **Deux choses, et une seule compte vraiment.** La liste d'embarquement
 * pré-téléchargée, qui permet de dire oui ou non sans serveur ; et la file des
 * validations faites hors ligne, qui remonte au retour du réseau. Perdre la
 * première fait revenir au papier ; perdre la seconde fait embarquer des gens
 * sans que personne ne le sache.
 *
 * `localStorage` et non IndexedDB : une liste d'embarquement, c'est quelques
 * dizaines de passagers — de l'ordre de la dizaine de kilo-octets, très loin des
 * cinq mégaoctets disponibles. IndexedDB coûterait une couche asynchrone et une
 * gestion de migrations pour un gain nul à cette taille. **À revoir si un départ
 * dépassait le millier de passagers**, ce qu'aucun car ne fait.
 */
const LIST_KEY = 'motoboy.boarding.list'
const QUEUE_KEY = 'motoboy.boarding.queue'

export interface PendingValidation {
  /**
   * Tiré par l'appareil, **conservé jusqu'à l'acquittement**.
   *
   * C'est lui qui distingue un renvoi d'un doublon : sans lui, chaque coupure
   * réseau fabriquerait un faux doublon, et la statistique censée révéler une
   * vraie fraude deviendrait du bruit.
   */
  readonly client_id: string
  readonly ticket_reference: string
  readonly validated_at: string
  readonly method: 'SCAN' | 'MANUAL'
}

export interface StoredList {
  readonly reference: string
  readonly list: BoardingList
  /** Quand la copie a été prise, pour que l'agent juge sa fraîcheur. */
  readonly downloadedAt: string
}

export function readList(reference: string): StoredList | null {
  const stored = parse<StoredList>(localStorage.getItem(LIST_KEY))

  /*
   * Une liste d'un autre départ ne sert à rien et serait dangereuse : elle
   * ferait accepter un billet valide, mais pour un autre car.
   */
  return stored !== null && stored.reference === reference ? stored : null
}

export function storeList(reference: string, list: BoardingList): StoredList {
  const stored: StoredList = { reference, list, downloadedAt: new Date().toISOString() }

  localStorage.setItem(LIST_KEY, JSON.stringify(stored))

  return stored
}

export function readQueue(): readonly PendingValidation[] {
  const stored = parse<PendingValidation[]>(localStorage.getItem(QUEUE_KEY))

  return Array.isArray(stored) ? stored : []
}

/**
 * Ajoute une validation à la file.
 *
 * **Écrit avant tout appel réseau**, jamais après : une validation faite puis
 * perdue parce que l'onglet s'est fermé pendant la requête est un passager
 * embarqué que personne ne compte.
 *
 * Le même billet scanné deux fois n'entre qu'une fois : c'est un double scan de
 * l'agent, pas un doublon à signaler.
 */
export function enqueue(entry: PendingValidation): readonly PendingValidation[] {
  const queue = readQueue()

  if (queue.some((pending) => pending.ticket_reference === entry.ticket_reference)) {
    return queue
  }

  const next = [...queue, entry]

  localStorage.setItem(QUEUE_KEY, JSON.stringify(next))

  return next
}

/**
 * Retire de la file ce que le serveur a acquitté.
 *
 * **Par `client_id` et non par référence de billet** : c'est l'identifiant que la
 * réponse renvoie tel quel, et le seul qui désigne sans ambiguïté l'entrée à
 * purger. Retirer par billet effacerait aussi une validation faite entre-temps.
 */
export function acknowledge(clientIds: readonly string[]): readonly PendingValidation[] {
  const next = readQueue().filter((pending) => !clientIds.includes(pending.client_id))

  localStorage.setItem(QUEUE_KEY, JSON.stringify(next))

  return next
}

/** Un identifiant d'appareil, sans dépendre de `crypto` — absent sous certains moteurs. */
export function newClientId(): string {
  const provided = globalThis.crypto

  if (typeof provided?.randomUUID === 'function') return provided.randomUUID()

  return `cid-${Date.now().toString(36)}-${Math.trunc(Math.random() * 1e9).toString(36)}`
}

/**
 * Extrait la référence d'un QR de billet.
 *
 * Format : `MTB1:<référence>:<signature>`. **La signature n'est pas vérifiée
 * ici**, et c'est délibéré : le faire exigerait de distribuer la clé de signature
 * sur chaque téléphone d'agent, ce qui la rendrait vulnérable. C'est
 * l'appartenance à la liste pré-téléchargée qui fait foi (B3).
 *
 * Une saisie manuelle passe aussi par ici : l'agent tape la référence seule, et
 * la reconnaître évite un second chemin de code.
 */
export function referenceFrom(payload: string): string | null {
  const trimmed = payload.trim().toUpperCase()

  if (trimmed === '') return null

  if (!trimmed.startsWith('MTB1:')) return trimmed

  const parts = trimmed.split(':')

  return parts[1] !== undefined && parts[1] !== '' ? parts[1] : null
}

function parse<T>(raw: string | null): T | null {
  if (raw === null) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    // Une forme ancienne ou corrompue est ignorée plutôt que de faire échouer
    // l'embarquement — c'est le pire moment pour un écran blanc.
    return null
  }
}
