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
  readonly payment: {
    readonly title: string
    readonly amount: string
    readonly operator: string
    readonly payerPhone: string
    readonly payerHint: string
    readonly submit: string
    readonly waiting: {
      readonly title: string
      readonly body: string
      readonly patience: string
    }
    readonly failed: {
      readonly title: string
      readonly body: string
      readonly retry: string
    }
    readonly succeeded: {
      readonly title: string
      readonly body: string
      readonly seeTicket: string
    }
    readonly expired: {
      readonly title: string
      readonly body: string
      readonly restart: string
    }
  }
  readonly ticket: {
    readonly title: string
    readonly listTitle: string
    readonly empty: string
    readonly passenger: string
    readonly seat: string
    readonly noSeat: string
    readonly reference: string
    readonly showAtBoarding: string
    readonly offline: string
    readonly cancelled: string
    readonly used: string
    readonly departure: string
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
    payment: {
      title: 'Paiement',
      amount: 'Montant à payer',
      operator: 'Opérateur',
      payerPhone: 'Numéro à débiter',
      // Le remboursement repartira **toujours** vers ce compte, jamais vers un
      // numéro déclaré après coup (B5).
      payerHint: 'Un remboursement éventuel retournera sur ce numéro.',
      submit: 'Payer',
      waiting: {
        title: 'Vérifiez votre téléphone',
        // Le trait qui compte : rien n'est encaissé tant que le passager n'a
        // pas saisi son code sur son propre téléphone.
        body: 'Une demande de confirmation vous a été envoyée. Saisissez votre code secret pour valider.',
        patience: 'Cela peut prendre jusqu’à une minute.',
      },
      failed: {
        title: 'Paiement non abouti',
        // Avec Mobile Money l'échec est banal, et réessayer est le cas
        // nominal : la place n'est pas perdue pour autant (B2).
        body: 'Vos places restent tenues. Vous pouvez réessayer.',
        retry: 'Réessayer',
      },
      succeeded: {
        title: 'Paiement confirmé',
        body: 'Votre billet est disponible.',
        seeTicket: 'Voir le billet',
      },
      expired: {
        title: 'Délai écoulé',
        body: 'Les places ont été libérées. Il faut recommencer la réservation.',
        restart: 'Nouvelle recherche',
      },
    },
    ticket: {
      title: 'Billet',
      listTitle: 'Mes billets',
      empty: 'Aucun billet pour le moment.',
      passenger: 'Passager',
      seat: 'Place',
      noSeat: 'Non numérotée',
      reference: 'Référence',
      showAtBoarding: 'Présentez ce code à l’embarquement.',
      // Le billet est en cache : il s'affiche sans réseau, et le QR est
      // regénéré depuis les données stockées (I5).
      offline: 'Ce billet s’affiche sans connexion.',
      cancelled: 'Billet annulé',
      used: 'Billet déjà utilisé',
      departure: 'Départ',
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
    payment: {
      title: 'Payment',
      amount: 'Amount due',
      operator: 'Operator',
      payerPhone: 'Number to debit',
      payerHint: 'Any refund will go back to this number.',
      submit: 'Pay',
      waiting: {
        title: 'Check your phone',
        body: 'A confirmation request has been sent. Enter your PIN to approve it.',
        patience: 'This can take up to a minute.',
      },
      failed: {
        title: 'Payment did not go through',
        body: 'Your seats are still held. You can try again.',
        retry: 'Try again',
      },
      succeeded: {
        title: 'Payment confirmed',
        body: 'Your ticket is ready.',
        seeTicket: 'View ticket',
      },
      expired: {
        title: 'Time is up',
        body: 'The seats have been released. You will need to book again.',
        restart: 'New search',
      },
    },
    ticket: {
      title: 'Ticket',
      listTitle: 'My tickets',
      empty: 'No tickets yet.',
      passenger: 'Passenger',
      seat: 'Seat',
      noSeat: 'Unnumbered',
      reference: 'Reference',
      showAtBoarding: 'Show this code at boarding.',
      offline: 'This ticket works without a connection.',
      cancelled: 'Ticket cancelled',
      used: 'Ticket already used',
      departure: 'Departure',
    },
    tabs: {
      search: 'Search',
      tickets: 'My tickets',
      account: 'Account',
    },
  },
}
