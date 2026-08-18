import { useCallback, useEffect, useState } from 'react'
import { unwrap } from '@motoboy/api-client'
import { api } from '../../lib/api'
import {
  acknowledge,
  enqueue,
  newClientId,
  readList,
  readQueue,
  storeList,
  type PendingValidation,
  type StoredList,
} from './offline'

/**
 * Vrai quand le navigateur se croit en ligne.
 *
 * **« Se croit » est le mot juste** : `navigator.onLine` ne dit que l'existence
 * d'une interface réseau, pas qu'un serveur répond. Sur le wifi d'une gare qui
 * accepte l'association sans router quoi que ce soit, il vaut `true` et ment.
 * On s'en sert pour *proposer* une synchronisation, jamais pour décider qu'une
 * validation est passée — seule la réponse du serveur le décide.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)

    globalThis.addEventListener('online', up)
    globalThis.addEventListener('offline', down)

    return () => {
      globalThis.removeEventListener('online', up)
      globalThis.removeEventListener('offline', down)
    }
  }, [])

  return online
}

/**
 * L'embarquement d'un départ, utilisable sans réseau.
 *
 * Le cycle tient en trois gestes : **télécharger** la liste au bureau, **valider**
 * sur le quai — hors ligne, contre la copie locale — et **synchroniser** au
 * retour du réseau.
 */
export function useOfflineBoarding(reference: string) {
  const [stored, setStored] = useState<StoredList | null>(() => readList(reference))
  const [queue, setQueue] = useState<readonly PendingValidation[]>(() => readQueue())
  const [downloading, setDownloading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<unknown>(null)

  // La référence change quand l'agent bascule de départ : la copie locale de
  // l'autre départ ne doit pas rester affichée.
  useEffect(() => setStored(readList(reference)), [reference])

  const download = useCallback(async () => {
    setDownloading(true)
    setError(null)

    try {
      const list = unwrap(
        await api.GET('/v1/agency/trips/{reference}/boarding-list', {
          params: { path: { reference } },
        }),
      )

      setStored(storeList(reference, list))
    } catch (cause) {
      setError(cause)
    } finally {
      setDownloading(false)
    }
  }, [reference])

  /**
   * Valide un billet **sans réseau**.
   *
   * La décision se prend contre la copie locale : le billet appartient-il à ce
   * départ ? Le reste — doublon réel, billet annulé entre-temps — se tranche au
   * serveur à la synchronisation. Trancher ici ce qu'on ne peut pas savoir
   * refuserait des passagers légitimes sur une supposition.
   */
  const validate = useCallback(
    (ticketReference: string, method: 'SCAN' | 'MANUAL') => {
      const known = stored?.list.passengers.find(
        (passenger) => passenger.ticket_reference === ticketReference,
      )

      if (known === undefined) return { outcome: 'UNKNOWN' as const }

      if (queue.some((pending) => pending.ticket_reference === ticketReference)) {
        return { outcome: 'ALREADY_QUEUED' as const, passenger: known }
      }

      if (known.status === 'USED') {
        return { outcome: 'ALREADY_USED' as const, passenger: known }
      }

      setQueue(
        enqueue({
          client_id: newClientId(),
          ticket_reference: ticketReference,
          validated_at: new Date().toISOString(),
          method,
        }),
      )

      return { outcome: 'ACCEPTED' as const, passenger: known }
    },
    [stored, queue],
  )

  /**
   * Remonte la file au serveur.
   *
   * **En un lot, et purgée par `client_id`.** Envoyer une par une multiplierait
   * les allers-retours sur la connexion la plus mauvaise du parcours, et purger
   * par billet effacerait une validation faite entre-temps.
   */
  const sync = useCallback(async () => {
    const pending = readQueue()

    if (pending.length === 0) return

    setSyncing(true)
    setError(null)

    try {
      const result = unwrap(
        await api.POST('/v1/agency/trips/{reference}/validations', {
          params: {
            path: { reference },
            header: { 'Idempotency-Key': newClientId() },
          },
          body: { validations: [...pending] },
        }),
      )

      /*
       * Acquitté **quel que soit le verdict** : un billet refusé par le serveur
       * est traité, pas en attente. Le laisser dans la file le renverrait
       * indéfiniment.
       */
      setQueue(acknowledge(result.results.map((entry) => entry.client_id)))

      // La liste locale repart du serveur : elle porte maintenant les
      // validations des autres agents du même départ.
      await download()

      return result
    } catch (cause) {
      setError(cause)

      return undefined
    } finally {
      setSyncing(false)
    }
  }, [reference, download])

  return { stored, queue, download, validate, sync, downloading, syncing, error }
}
