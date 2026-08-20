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
  /**
   * L'inventaire : gares, véhicules, chauffeurs, itinéraires.
   *
   * Quatre pages qu'une agence remplit une fois puis ne rouvre qu'à la marge —
   * et dont chaque ligne conditionne la suivante. Un itinéraire sans gares, un
   * horaire sans véhicule : c'est là que se joue la mise en service.
   */
  readonly inventory: {
    readonly stations: {
      readonly title: string
      readonly subtitle: string
      readonly emptyTitle: string
      readonly emptyBody: string
      readonly add: string
      readonly newTitle: string
      readonly name: string
      readonly namePlaceholder: string
      readonly city: string
      readonly address: string
      readonly create: string
      readonly head: {
        readonly name: string
        readonly city: string
        readonly address: string
        readonly status: string
      }
      readonly requestCity: string
      readonly requestCityHelp: string
      readonly country: string
      readonly cityName: string
      readonly sendRequest: string
      readonly requestSent: string
    }
    readonly vehicles: {
      readonly title: string
      readonly subtitle: string
      readonly emptyTitle: string
      readonly emptyBody: string
      readonly add: string
      readonly newTitle: string
      readonly plate: string
      readonly platePlaceholder: string
      readonly make: string
      readonly model: string
      readonly type: string
      readonly bus: string
      readonly car: string
      readonly seating: string
      readonly byCapacity: string
      readonly assignedSeat: string
      readonly seats: string
      readonly create: string
      readonly head: {
        readonly plate: string
        readonly model: string
        readonly type: string
        readonly seating: string
        readonly seats: string
      }
    }
    readonly drivers: {
      readonly title: string
      readonly subtitle: string
      readonly emptyTitle: string
      readonly emptyBody: string
      readonly add: string
      readonly newTitle: string
      readonly firstName: string
      readonly lastName: string
      readonly phone: string
      readonly phonePlaceholder: string
      readonly licence: string
      readonly licenceExpiry: string
      readonly usualVehicle: string
      readonly none: string
      readonly create: string
      readonly head: {
        readonly name: string
        readonly phone: string
        readonly licence: string
        readonly expiry: string
        readonly status: string
      }
    }
    readonly routes: {
      readonly title: string
      readonly subtitle: string
      readonly emptyTitle: string
      readonly emptyBody: string
      readonly add: string
      readonly newTitle: string
      readonly origin: string
      readonly destination: string
      readonly duration: string
      readonly create: string
      readonly addSchedule: string
      readonly departureTime: string
      readonly days: string
      readonly price: string
      readonly vehicle: string
      readonly driver: string
      readonly choose: string
      readonly unassigned: string
      readonly createSchedule: string
      readonly generate: string
      readonly from: string
    }
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
    inventory: {
      stations: {
        title: 'Gares',
        subtitle:
          'Les points de départ et d’arrivée de vos itinéraires. Une gare nouvelle est vérifiée par MOTOBOY avant d’apparaître dans la recherche.',
        emptyTitle: 'Aucune gare',
        emptyBody:
          'Commencez par déclarer une gare : tout le reste de l’inventaire s’y rattache.',
        add: 'Ajouter une gare',
        newTitle: 'Nouvelle gare',
        name: 'Nom de la gare',
        namePlaceholder: 'Gare de Bonabéri',
        city: 'Ville',
        address: 'Adresse (facultatif)',
        create: 'Créer la gare',
        head: { name: 'Nom', city: 'Ville', address: 'Adresse', status: 'État' },
        requestCity: 'Demander une ville',
        requestCityHelp:
          'Si la ville que vous desservez n’apparaît pas, demandez-la. MOTOBOY la rattachera au référentiel — c’est ce qui évite deux Douala.',
        country: 'Pays',
        cityName: 'Nom de la ville',
        sendRequest: 'Envoyer la demande',
        requestSent: 'Demande transmise. Elle apparaîtra dès qu’elle sera acceptée.',
      },
      vehicles: {
        title: 'Véhicules',
        subtitle:
          'Votre parc. Le mode de placement choisi à la déclaration détermine si les passagers choisiront leur siège.',
        emptyTitle: 'Aucun véhicule',
        emptyBody:
          'Un itinéraire ne produit de départs qu’avec un véhicule pour les assurer.',
        add: 'Ajouter un véhicule',
        newTitle: 'Nouveau véhicule',
        plate: 'Immatriculation',
        platePlaceholder: 'LT-4412-AB',
        make: 'Marque (facultatif)',
        model: 'Modèle (facultatif)',
        type: 'Type',
        bus: 'Bus',
        car: 'Voiture',
        seating: 'Mode de placement',
        byCapacity: 'Par capacité',
        assignedSeat: 'Siège choisi',
        seats: 'Nombre de places',
        create: 'Ajouter le véhicule',
        head: {
          plate: 'Immatriculation',
          model: 'Modèle',
          type: 'Type',
          seating: 'Placement',
          seats: 'Places',
        },
      },
      drivers: {
        title: 'Chauffeurs',
        subtitle:
          'Vos chauffeurs salariés. Vous répondez de leur permis — MOTOBOY ne les modère pas.',
        emptyTitle: 'Aucun chauffeur',
        emptyBody:
          'Un horaire peut désigner un chauffeur par défaut ; sans chauffeur déclaré, ce choix reste vide.',
        add: 'Ajouter un chauffeur',
        newTitle: 'Nouveau chauffeur',
        firstName: 'Prénom',
        lastName: 'Nom',
        phone: 'Téléphone',
        phonePlaceholder: '+237 6XX XX XX XX',
        licence: 'Numéro de permis',
        licenceExpiry: 'Échéance du permis (facultatif)',
        usualVehicle: 'Véhicule habituel (facultatif)',
        none: 'Aucun',
        create: 'Ajouter le chauffeur',
        head: {
          name: 'Nom',
          phone: 'Téléphone',
          licence: 'Permis',
          expiry: 'Échéance',
          status: 'État',
        },
      },
      routes: {
        title: 'Itinéraires et horaires',
        subtitle:
          'Un itinéraire relie deux gares. Un horaire le fait partir régulièrement. Les départs, eux, sont générés.',
        emptyTitle: 'Aucun itinéraire',
        emptyBody: 'Déclarez d’abord deux gares, puis reliez-les par un itinéraire.',
        add: 'Ajouter un itinéraire',
        newTitle: 'Nouvel itinéraire',
        origin: 'Gare de départ',
        destination: 'Gare d’arrivée',
        duration: 'Durée de référence en minutes (facultatif)',
        create: 'Créer l’itinéraire',
        addSchedule: 'Ajouter un horaire',
        departureTime: 'Heure de départ',
        days: 'Jours de circulation',
        price: 'Prix en FCFA',
        vehicle: 'Véhicule',
        driver: 'Chauffeur (facultatif)',
        choose: 'Choisir…',
        unassigned: 'Non assigné',
        createSchedule: 'Créer l’horaire',
        generate: 'Générer les départs',
        from: 'À partir du',
      },
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
    inventory: {
      stations: {
        title: 'Stations',
        subtitle:
          'The start and end points of your routes. A new station is checked by MOTOBOY before it appears in search.',
        emptyTitle: 'No stations',
        emptyBody:
          'Start by declaring a station: everything else in your inventory hangs off it.',
        add: 'Add a station',
        newTitle: 'New station',
        name: 'Station name',
        namePlaceholder: 'Bonabéri station',
        city: 'Town',
        address: 'Address (optional)',
        create: 'Create the station',
        head: { name: 'Name', city: 'Town', address: 'Address', status: 'Status' },
        requestCity: 'Request a town',
        requestCityHelp:
          'If the town you serve is not listed, ask for it. MOTOBOY will attach it to the reference list — that is what prevents two Doualas.',
        country: 'Country',
        cityName: 'Town name',
        sendRequest: 'Send the request',
        requestSent: 'Request sent. It will appear once accepted.',
      },
      vehicles: {
        title: 'Vehicles',
        subtitle:
          'Your fleet. The seating mode chosen at declaration decides whether passengers pick their seat.',
        emptyTitle: 'No vehicles',
        emptyBody: 'A route only produces departures once a vehicle can run them.',
        add: 'Add a vehicle',
        newTitle: 'New vehicle',
        plate: 'Registration',
        platePlaceholder: 'LT-4412-AB',
        make: 'Make (optional)',
        model: 'Model (optional)',
        type: 'Type',
        bus: 'Bus',
        car: 'Car',
        seating: 'Seating mode',
        byCapacity: 'By capacity',
        assignedSeat: 'Assigned seat',
        seats: 'Number of seats',
        create: 'Add the vehicle',
        head: {
          plate: 'Registration',
          model: 'Model',
          type: 'Type',
          seating: 'Seating',
          seats: 'Seats',
        },
      },
      drivers: {
        title: 'Drivers',
        subtitle:
          'Your employed drivers. Their licence is your responsibility — MOTOBOY does not vet them.',
        emptyTitle: 'No drivers',
        emptyBody:
          'A schedule can name a default driver; with none declared, that choice stays empty.',
        add: 'Add a driver',
        newTitle: 'New driver',
        firstName: 'First name',
        lastName: 'Last name',
        phone: 'Phone',
        phonePlaceholder: '+237 6XX XX XX XX',
        licence: 'Licence number',
        licenceExpiry: 'Licence expiry (optional)',
        usualVehicle: 'Usual vehicle (optional)',
        none: 'None',
        create: 'Add the driver',
        head: {
          name: 'Name',
          phone: 'Phone',
          licence: 'Licence',
          expiry: 'Expiry',
          status: 'Status',
        },
      },
      routes: {
        title: 'Routes and schedules',
        subtitle:
          'A route links two stations. A schedule makes it run regularly. Departures themselves are generated.',
        emptyTitle: 'No routes',
        emptyBody: 'Declare two stations first, then link them with a route.',
        add: 'Add a route',
        newTitle: 'New route',
        origin: 'Departure station',
        destination: 'Arrival station',
        duration: 'Reference duration in minutes (optional)',
        create: 'Create the route',
        addSchedule: 'Add a schedule',
        departureTime: 'Departure time',
        days: 'Running days',
        price: 'Price in FCFA',
        vehicle: 'Vehicle',
        driver: 'Driver (optional)',
        choose: 'Choose…',
        unassigned: 'Unassigned',
        createSchedule: 'Create the schedule',
        generate: 'Generate departures',
        from: 'From',
      },
    },
  },
}
