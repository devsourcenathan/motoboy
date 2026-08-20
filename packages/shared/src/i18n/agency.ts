import type { Locale } from '../locale.js'

/**
 * L'espace agence.
 *
 * **Pourquoi il est traduit alors que l'administration ne l'est pas.** Le brief
 * ([I10]) distingue les deux : l'administration est un outil interne, l'espace
 * agence est utilisé par des gens qu'on ne recrute pas — le personnel des gares
 * de Buea, Bamenda ou Limbe, dont la langue de travail est l'anglais. Un
 * back-office francophone y devient une barriere a l'entree sur la plateforme,
 * pas une simple gene.
 *
 * Separe de `boarding` : le quai se lit debout, souvent hors reseau, et son ton
 * est plus imperatif que celui du bureau. Les fondre ferait deriver les deux.
 */
export interface AgencyMessages {
  readonly nav: {
    readonly stations: string
    readonly vehicles: string
    readonly drivers: string
    readonly routes: string
    readonly departures: string
    readonly counter: string
    readonly boarding: string
    readonly money: string
    readonly staff: string
    readonly documents: string
    readonly signOut: string
  }
  readonly departures: {
    readonly title: string
    readonly subtitle: string
    readonly from: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly head: {
      readonly departure: string
      readonly route: string
      readonly price: string
      readonly seats: string
      readonly reference: string
    }
    readonly cancel: string
    readonly reason: string
    readonly note: string
    readonly reasons: {
      readonly vehicleBreakdown: string
      readonly roadClosed: string
      readonly notEnoughPassengers: string
      readonly other: string
    }
  }
  readonly counter: {
    readonly title: string
    readonly subtitle: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly departure: string
    readonly firstName: string
    readonly lastName: string
    readonly phone: string
    readonly phonePlaceholder: string
    readonly sell: string
    readonly cancelSection: string
    readonly cancelHelp: string
    readonly bookingReference: string
    readonly bookingPlaceholder: string
    readonly cancelAction: string
    readonly confirm: string
    readonly back: string
    /** Nomme la reference **et** le remboursement : deux effets sans retour. */
    readonly confirmQuestion: string
    readonly cancelled: string
    readonly cancelledWithRefund: string
  }
}

export const agencyMessages: Record<Locale, AgencyMessages> = {
  fr: {
    nav: {
      stations: 'Gares',
      vehicles: 'Véhicules',
      drivers: 'Chauffeurs',
      routes: 'Itinéraires',
      departures: 'Départs',
      counter: 'Guichet',
      boarding: 'Embarquement',
      money: 'Compte',
      staff: 'Personnel',
      documents: 'Pièces',
      signOut: 'Se déconnecter',
    },
    departures: {
      title: 'Départs',
      subtitle:
        'Ce que le passager voit dans la recherche. Annuler un départ rembourse intégralement toutes ses réservations.',
      from: 'À partir du',
      emptyTitle: 'Aucun départ sur cette période',
      emptyBody:
        'Les départs viennent des horaires. Créez un horaire, puis lancez la génération depuis l’onglet Itinéraires.',
      head: {
        departure: 'Départ',
        route: 'Trajet',
        price: 'Prix',
        seats: 'Places',
        reference: 'Référence',
      },
      cancel: 'Annuler ce départ et rembourser',
      reason: 'Motif',
      note: 'Précision (facultatif)',
      reasons: {
        vehicleBreakdown: 'Panne du véhicule',
        roadClosed: 'Route coupée',
        notEnoughPassengers: 'Effectif insuffisant',
        other: 'Autre',
      },
    },
    counter: {
      title: 'Guichet',
      subtitle:
        'Vendre à quelqu’un qui est devant vous. Les places vendues ici disparaissent immédiatement de la recherche.',
      emptyTitle: 'Aucun départ aujourd’hui',
      emptyBody:
        'Le guichet vend sur les départs à venir. Générez-les depuis l’onglet Itinéraires.',
      departure: 'Départ',
      firstName: 'Prénom',
      lastName: 'Nom',
      phone: 'Téléphone',
      phonePlaceholder: '+237 6XX XX XX XX',
      sell: 'Vendre',
      cancelSection: 'Annuler une réservation',
      cancelHelp:
        'Demandez la référence au passager — elle figure sur son SMS de confirmation.',
      bookingReference: 'Référence de la réservation',
      bookingPlaceholder: 'MTB-XXXXXX',
      cancelAction: 'Annuler cette réservation',
      confirm: 'Confirmer',
      back: 'Revenir',
      confirmQuestion: 'Annuler {{reference}} et rembourser le passager ?',
      cancelled: 'Réservation annulée.',
      cancelledWithRefund: 'Réservation annulée — {{amount}} remboursés au passager.',
    },
  },
  en: {
    nav: {
      stations: 'Stations',
      vehicles: 'Vehicles',
      drivers: 'Drivers',
      routes: 'Routes',
      departures: 'Departures',
      counter: 'Counter',
      boarding: 'Boarding',
      money: 'Account',
      staff: 'Staff',
      documents: 'Documents',
      signOut: 'Sign out',
    },
    departures: {
      title: 'Departures',
      subtitle:
        'What passengers see in search. Cancelling a departure refunds every booking on it in full.',
      from: 'From',
      emptyTitle: 'No departures in this period',
      emptyBody:
        'Departures come from schedules. Create a schedule, then generate from the Routes tab.',
      head: {
        departure: 'Departure',
        route: 'Route',
        price: 'Price',
        seats: 'Seats',
        reference: 'Reference',
      },
      cancel: 'Cancel this departure and refund',
      reason: 'Reason',
      note: 'Details (optional)',
      reasons: {
        vehicleBreakdown: 'Vehicle breakdown',
        roadClosed: 'Road closed',
        notEnoughPassengers: 'Not enough passengers',
        other: 'Other',
      },
    },
    counter: {
      title: 'Counter',
      subtitle:
        'Sell to someone standing in front of you. Seats sold here leave search immediately.',
      emptyTitle: 'No departure today',
      emptyBody:
        'The counter sells on upcoming departures. Generate them from the Routes tab.',
      departure: 'Departure',
      firstName: 'First name',
      lastName: 'Last name',
      phone: 'Phone',
      phonePlaceholder: '+237 6XX XX XX XX',
      sell: 'Sell',
      cancelSection: 'Cancel a booking',
      cancelHelp:
        'Ask the passenger for the reference — it is on their confirmation SMS.',
      bookingReference: 'Booking reference',
      bookingPlaceholder: 'MTB-XXXXXX',
      cancelAction: 'Cancel this booking',
      confirm: 'Confirm',
      back: 'Back',
      confirmQuestion: 'Cancel {{reference}} and refund the passenger?',
      cancelled: 'Booking cancelled.',
      cancelledWithRefund: 'Booking cancelled — {{amount}} refunded to the passenger.',
    },
  },
}
