import type { Locale } from '../locale.js'

/**
 * Textes des écrans du **parcours passager**.
 *
 * Un catalogue par espace produit — passager, agence, administration — et non
 * un par application : c'est le découpage qui a un sens pour qui traduit, et il
 * survit au jour où le parcours passager existera aussi sur le web.
 *
 * **Point d'entrée dédié.** Ce fichier n'est pas réexporté par l'index du
 * package : Metro ne secoue pas l'arbre, et le passer par l'index ferait
 * embarquer au mobile les textes du back-office. On l'importe donc par
 * `@motoboy/shared/i18n/passenger`.
 *
 * Le type croisé `Record<Locale, PassengerMessages>` fait travailler le
 * compilateur dans les deux dimensions : une clé ajoutée casse la compilation
 * tant qu'elle manque **dans une langue**. Le Cameroun est bilingue, et une
 * interface conçue en une seule langue se réécrit pour en accueillir une
 * seconde.
 */
export interface PassengerMessages {
  readonly onboarding: {
    readonly skip: string
    readonly next: string
    readonly start: string
    readonly slides: readonly {
      readonly title: string
      readonly body: string
    }[]
  }
  readonly search: {
    readonly title: string
    readonly from: string
    readonly to: string
    readonly date: string
    readonly today: string
    readonly tomorrow: string
    readonly submit: string
    readonly swap: string
    readonly pickCity: string
    readonly searchCity: string
    readonly noCity: string
    readonly typeMore: string
    readonly sameCity: string
  }
  readonly results: {
    readonly title: string
    readonly seatsLeft: string
    readonly soldOut: string
    readonly directOnly: string
    readonly via: string
    readonly freeCancellation: string
    readonly cancellationFee: string
    readonly noCancellation: string
    readonly empty: {
      readonly title: string
      readonly body: string
      readonly nearbyDates: string
      readonly otherRoutes: string
      readonly tripsCount: string
      readonly from: string
    }
  }
  readonly trip: {
    readonly seatMap: string
    readonly pickSeats: string
    readonly seatsChosen: string
    readonly continue: string
    readonly legend: {
      readonly available: string
      readonly selected: string
      readonly held: string
      readonly taken: string
    }
    readonly heldHint: string
    readonly capacityMode: string
    readonly passengers: string
    readonly seatTaken: string
  }
  readonly booking: {
    readonly title: string
    readonly passenger: string
    readonly firstName: string
    readonly lastName: string
    readonly contact: string
    readonly contactPhone: string
    readonly contactHint: string
    readonly submit: string
    readonly seatLabel: string
    readonly held: {
      readonly title: string
      readonly body: string
      readonly expired: string
      readonly restart: string
    }
    readonly conflict: {
      readonly seatTaken: string
      readonly tripFull: string
      readonly closed: string
      readonly pickAnother: string
    }
  }
  readonly tabs: {
    readonly search: string
    readonly tickets: string
    readonly account: string
  }
}

export const passengerMessages: Record<Locale, PassengerMessages> = {
  fr: {
    onboarding: {
      skip: 'Passer',
      next: 'Suivant',
      start: 'Commencer',
      slides: [
        {
          title: 'Comparez avant de partir',
          // Le problème que le produit résout, dit avec les mots du passager :
          // aujourd'hui il faut aller de gare en gare pour connaître les prix
          // et les horaires.
          body: 'Horaires, prix et places disponibles de plusieurs agences, sans faire le tour des gares.',
        },
        {
          title: 'Réservez votre place',
          body: 'Choisissez votre siège et payez par Mobile Money. Votre place est tenue le temps du paiement.',
        },
        {
          title: 'Votre billet, même sans réseau',
          // La promesse qui compte en gare : le QR est regénéré depuis le
          // téléphone, il ne dépend pas de la couverture (I5).
          body: 'Le billet reste dans votre téléphone. Présentez le code à l’embarquement, avec ou sans connexion.',
        },
      ],
    },
    search: {
      title: 'Où allez-vous ?',
      from: 'Départ',
      to: 'Arrivée',
      date: 'Date',
      today: "Aujourd'hui",
      tomorrow: 'Demain',
      submit: 'Rechercher',
      swap: 'Inverser',
      pickCity: 'Choisir une ville',
      searchCity: 'Ville ou gare',
      noCity: 'Aucune ville trouvée',
      typeMore: 'Saisissez au moins deux lettres',
      sameCity: 'Le départ et l’arrivée doivent être différents',
    },
    results: {
      title: '{{from}} → {{to}}',
      seatsLeft: '{{count}} place(s)',
      soldOut: 'Complet',
      directOnly: 'Direct',
      via: 'via {{stops}}',
      // Les conditions varient d'une agence à l'autre : c'est un critère de
      // comparaison affiché, pas une ligne de conditions générales (B5).
      freeCancellation: 'Annulation gratuite jusqu’à H-{{hours}}',
      cancellationFee: 'Annulation {{fee}} jusqu’à H-{{hours}}',
      noCancellation: 'Non annulable',
      empty: {
        title: 'Aucun départ ce jour-là',
        body: 'Voici ce que nous avons trouvé de plus proche.',
        nearbyDates: 'Autres dates',
        otherRoutes: 'Depuis {{city}}',
        tripsCount: '{{count}} départ(s)',
        from: 'dès {{price}}',
      },
    },
    trip: {
      seatMap: 'Choisissez vos places',
      pickSeats: 'Sélectionnez {{count}} place(s)',
      seatsChosen: '{{chosen}} / {{total}} sélectionnée(s)',
      continue: 'Continuer',
      legend: {
        available: 'Libre',
        selected: 'Choisie',
        held: 'Réservée',
        taken: 'Vendue',
      },
      // Une place tenue est indisponible **au même titre** qu'une place
      // vendue : le passager n'a pas à connaître l'échéance, elle ne lui sert
      // à rien et exposerait le rythme des ventes d'une agence (B2).
      heldHint: 'Une place réservée peut se libérer, mais rien ne le garantit.',
      capacityMode: 'Places non numérotées sur ce véhicule.',
      passengers: 'Passagers',
      seatTaken: 'Cette place vient d’être prise',
    },
    booking: {
      title: 'Vos informations',
      passenger: 'Passager {{index}}',
      firstName: 'Prénom',
      lastName: 'Nom',
      contact: 'Contact',
      contactPhone: 'Téléphone',
      contactHint: 'Le billet et les alertes de départ y seront envoyés.',
      submit: 'Réserver',
      seatLabel: 'Place {{label}}',
      held: {
        title: 'Places tenues',
        // Le passager doit savoir qu'il est chronométré : sans compte à
        // rebours, il ne comprend pas pourquoi son siège lui échappe (B2).
        body: 'Il vous reste {{time}} pour payer.',
        expired: 'Le délai est écoulé, les places ont été libérées.',
        restart: 'Recommencer',
      },
      conflict: {
        seatTaken: 'Une des places vient d’être prise.',
        tripFull: 'Ce départ est complet.',
        closed: 'Les réservations en ligne sont closes pour ce départ.',
        pickAnother: 'Choisir une autre place',
      },
    },
    tabs: {
      search: 'Rechercher',
      tickets: 'Mes billets',
      account: 'Compte',
    },
  },
  en: {
    onboarding: {
      skip: 'Skip',
      next: 'Next',
      start: 'Get started',
      slides: [
        {
          title: 'Compare before you travel',
          body: 'Times, fares and available seats from several agencies, without walking from station to station.',
        },
        {
          title: 'Book your seat',
          body: 'Pick your seat and pay with Mobile Money. Your seat is held while you pay.',
        },
        {
          title: 'Your ticket, even offline',
          body: 'The ticket stays on your phone. Show the code at boarding, with or without a connection.',
        },
      ],
    },
    search: {
      title: 'Where are you going?',
      from: 'From',
      to: 'To',
      date: 'Date',
      today: 'Today',
      tomorrow: 'Tomorrow',
      submit: 'Search',
      swap: 'Swap',
      pickCity: 'Pick a city',
      searchCity: 'City or station',
      noCity: 'No city found',
      typeMore: 'Type at least two letters',
      sameCity: 'Origin and destination must differ',
    },
    results: {
      title: '{{from}} → {{to}}',
      seatsLeft: '{{count}} seat(s)',
      soldOut: 'Sold out',
      directOnly: 'Direct',
      via: 'via {{stops}}',
      freeCancellation: 'Free cancellation until H-{{hours}}',
      cancellationFee: 'Cancellation {{fee}} until H-{{hours}}',
      noCancellation: 'Non-refundable',
      empty: {
        title: 'No departures that day',
        body: 'Here is the closest we found.',
        nearbyDates: 'Other dates',
        otherRoutes: 'From {{city}}',
        tripsCount: '{{count}} departure(s)',
        from: 'from {{price}}',
      },
    },
    trip: {
      seatMap: 'Choose your seats',
      pickSeats: 'Select {{count}} seat(s)',
      seatsChosen: '{{chosen}} / {{total}} selected',
      continue: 'Continue',
      legend: {
        available: 'Free',
        selected: 'Selected',
        held: 'Held',
        taken: 'Sold',
      },
      heldHint: 'A held seat may free up, but nothing guarantees it.',
      capacityMode: 'Unnumbered seating on this vehicle.',
      passengers: 'Passengers',
      seatTaken: 'That seat has just been taken',
    },
    booking: {
      title: 'Your details',
      passenger: 'Passenger {{index}}',
      firstName: 'First name',
      lastName: 'Last name',
      contact: 'Contact',
      contactPhone: 'Phone',
      contactHint: 'The ticket and departure alerts will be sent there.',
      submit: 'Book',
      seatLabel: 'Seat {{label}}',
      held: {
        title: 'Seats held',
        body: 'You have {{time}} left to pay.',
        expired: 'Time is up, the seats have been released.',
        restart: 'Start over',
      },
      conflict: {
        seatTaken: 'One of the seats has just been taken.',
        tripFull: 'This departure is full.',
        closed: 'Online sales are closed for this departure.',
        pickAnother: 'Pick another seat',
      },
    },
    tabs: {
      search: 'Search',
      tickets: 'My tickets',
      account: 'Account',
    },
  },
}
