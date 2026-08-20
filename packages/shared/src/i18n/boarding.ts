import type { Locale } from '../locale.js'

/**
 * L'embarquement, sur le quai.
 *
 * **Le personnel d'agence des régions anglophones l'est aussi** — c'est la
 * justification que donne le brief ([I10]) pour ne pas s'arrêter au parcours
 * passager. Buea et Bamenda ont des gares, et l'agent qui y valide les billets
 * lit son écran en anglais.
 *
 * Surface à part et non fondue dans celle de l'agence : elle s'utilise debout,
 * souvent hors réseau, sur un téléphone. Les textes y sont plus courts et plus
 * impératifs qu'au bureau, et les mêler ferait dériver les deux tons.
 */
export interface BoardingMessages {
  readonly title: string
  readonly network: {
    readonly online: string
    readonly offline: string
  }
  readonly trip: {
    readonly reference: string
    readonly download: string
    readonly downloading: string
    /** Dit **avant** de perdre le réseau, parce qu'après il est trop tard. */
    readonly downloadFirst: string
  }
  readonly manual: {
    readonly label: string
    readonly noCamera: string
    readonly submit: string
  }
  readonly queue: {
    readonly sync: string
    readonly syncing: string
    /** Ce qui n'est pas encore parti n'existe que sur cet appareil. */
    readonly warning: string
  }
  readonly outcome: {
    readonly accepted: string
    readonly alreadyBoarded: string
    readonly notOnThisTrip: string
    /** Un doublon n'est pas une fraude : c'est le plus souvent un double scan. */
    readonly checkSecondPerson: string
  }
  readonly list: {
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly noTripTitle: string
    readonly passenger: string
    readonly seat: string
    readonly ticket: string
    readonly status: string
    readonly boarded: string
    readonly expected: string
  }
}

export const boardingMessages: Record<Locale, BoardingMessages> = {
  fr: {
    title: 'Embarquement',
    network: { online: 'En ligne', offline: 'Hors ligne' },
    trip: {
      reference: 'Référence du départ',
      download: 'Télécharger la liste',
      downloading: 'Téléchargement…',
      downloadFirst:
        'Téléchargez la liste au bureau, tant que vous avez du réseau. Sur le quai, il sera trop tard.',
    },
    manual: {
      label: 'Saisie manuelle',
      noCamera: 'Cet appareil ne sait pas lire les QR : tout passe par ici.',
      submit: 'Valider',
    },
    queue: {
      sync: 'Synchroniser',
      syncing: 'Envoi…',
      warning:
        'Elles restent sur cet appareil tant qu’elles n’ont pas été envoyées. Ne le fermez pas avant.',
    },
    outcome: {
      accepted: 'Montez',
      alreadyBoarded: 'Déjà embarqué',
      notOnThisTrip: 'Pas sur ce départ',
      checkSecondPerson: 'Vérifiez qu’il ne s’agit pas d’une seconde personne.',
    },
    list: {
      emptyTitle: 'Aucun passager',
      emptyBody: 'Ce départ n’a pas encore de réservation confirmée.',
      noTripTitle: 'Aucun départ aujourd’hui',
      passenger: 'Passager',
      seat: 'Siège',
      ticket: 'Billet',
      status: 'État',
      boarded: 'Embarqué',
      expected: 'Attendu',
    },
  },
  en: {
    title: 'Boarding',
    network: { online: 'Online', offline: 'Offline' },
    trip: {
      reference: 'Departure reference',
      download: 'Download the list',
      downloading: 'Downloading…',
      downloadFirst:
        'Download the list at the office, while you still have signal. On the platform it will be too late.',
    },
    manual: {
      label: 'Type it in',
      noCamera: 'This device cannot read QR codes — everything goes through here.',
      submit: 'Check in',
    },
    queue: {
      sync: 'Sync',
      syncing: 'Sending…',
      warning:
        'They stay on this device until they have been sent. Do not close it before then.',
    },
    outcome: {
      accepted: 'Board',
      alreadyBoarded: 'Already boarded',
      notOnThisTrip: 'Not on this departure',
      checkSecondPerson: 'Check this is not a second person.',
    },
    list: {
      emptyTitle: 'No passengers',
      emptyBody: 'This departure has no confirmed booking yet.',
      noTripTitle: 'No departure today',
      passenger: 'Passenger',
      seat: 'Seat',
      ticket: 'Ticket',
      status: 'Status',
      boarded: 'Boarded',
      expected: 'Expected',
    },
  },
}
