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
    readonly subtitle: string
    readonly from: string
    readonly to: string
    readonly date: string
    readonly today: string
    readonly tomorrow: string
    readonly submit: string
    readonly swap: string
    readonly pickCity: string
    readonly fromExample: string
    readonly toExample: string
    readonly passengers: string
    readonly searchCity: string
    readonly noCity: string
    readonly noCityBody: string
    readonly typeMore: string
    readonly sameCity: string
    readonly greeting: string
    readonly recent: string
    readonly seeAll: string
    readonly promo: { readonly title: string; readonly body: string }
  }
  readonly results: {
    readonly title: string
    readonly filters: {
      readonly title: string
      readonly agencies: string
      readonly vehicle: string
      readonly onlyAvailable: string
      readonly departure: string
      readonly price: string
      readonly bracket: {
        readonly ANY: string
        readonly LOW: string
        readonly MID: string
        readonly HIGH: string
      }
      readonly period: {
        readonly ANY: string
        readonly MORNING: string
        readonly AFTERNOON: string
        readonly EVENING: string
      }
      readonly any: string
      readonly reset: string
      readonly apply: string
      readonly active: string
    }
    readonly summary: string
    readonly sort: {
      readonly best: string
      readonly price_asc: string
      readonly departure_asc: string
      readonly duration_asc: string
    }
    readonly choose: string
    readonly vehicle: { readonly BUS: string; readonly CAR: string }
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
    readonly details: string
    readonly date: string
    readonly busType: string
    readonly capacity: string
    readonly available: string
    readonly seatsUnit: string
    readonly pricePerPassenger: string
    readonly selectedSeats: string
    readonly total: string
    readonly choose: string
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
    readonly subtitle: string
    readonly mainPassenger: string
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
    readonly summary: string
    readonly agency: string
    readonly route: string
    readonly seats: string
    readonly total: string
    readonly totalToPay: string
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
      readonly reference: string
      readonly notified: string
      readonly seeTicket: string
      readonly home: string
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
    readonly listSubtitle: string
    readonly upcoming: string
    readonly history: string
    readonly seeQr: string
    readonly seeTicket: string
    readonly seats: string
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
    readonly confirmed: string
    readonly agency: string
    readonly origin: string
    readonly destination: string
    readonly date: string
    readonly time: string
  }
  readonly account: {
    readonly title: string
    readonly signIn: string
    readonly signUp: string
    readonly phone: string
    readonly phoneHint: string
    readonly firstName: string
    readonly lastName: string
    readonly continue: string
    readonly noAccount: string
    readonly haveAccount: string
    readonly signOut: string
    readonly history: string
    readonly historyEmpty: string
    readonly whyNeeded: string
    readonly tagline: string
    readonly welcome: string
    readonly signUpBody: string
    readonly emailOptional: string
    readonly authBody: string
    readonly language: string
    readonly languageName: string
    readonly historyHint: string
    readonly sectionAccount: string
    readonly sectionPreferences: string
    readonly settings: string
    readonly sectionSupport: string
    readonly currency: string
    readonly about: string
    readonly languageFr: string
    readonly languageEn: string
    readonly otp: {
      readonly title: string
      readonly sentTo: string
      readonly instruction: string
      readonly codeField: string
      readonly code: string
      readonly verify: string
      readonly resend: string
      readonly resendIn: string
      readonly attemptsLeft: string
      readonly expired: string
    }
  }
  readonly cancellation: {
    readonly title: string
    readonly whoLeaves: string
    readonly all: string
    readonly refundable: string
    readonly fee: string
    readonly free: string
    readonly deadline: string
    readonly toSource: string
    readonly counterSale: string
    readonly confirm: string
    readonly refused: {
      readonly deadlinePassed: string
      readonly notCancellable: string
    }
    readonly done: {
      readonly title: string
      readonly refunded: string
      readonly noRefund: string
      readonly pending: string
      readonly close: string
    }
  }
  readonly steps: {
    readonly seats: string
    readonly details: string
    readonly payment: string
  }
  readonly serviceCall: {
    readonly entry: string
    readonly entryHint: string
    readonly title: string
    readonly subtitle: string
    readonly from: string
    readonly to: string
    readonly landmark: string
    readonly landmarkHint: string
    readonly landmarkOptional: string
    readonly passengers: string
    readonly note: string
    readonly noteHint: string
    readonly submit: string
    readonly sameCity: string
    readonly missingLandmark: string
    readonly waiting: string
    readonly waitingBody: string
    readonly offers: string
    readonly eta: string
    readonly accept: string
    readonly expired: string
    readonly expiredBody: string
    readonly matched: string
    readonly matchedBody: string
    readonly driver: string
    readonly plate: string
    readonly meetAt: string
    readonly pay: string
    readonly paying: string
    readonly paid: string
    readonly noShow: string
    readonly noShowConfirm: string
    readonly cancel: string
    readonly cancelled: string
    readonly inProgress: string
    readonly completed: string
  }
  readonly driver: {
    readonly title: string
    readonly pitchTitle: string
    readonly pitchBody: string
    readonly requires: string
    readonly requiresLicence: string
    readonly requiresRegistration: string
    readonly requiresIdentity: string
    readonly requiresInsurance: string
    readonly start: string
    readonly resubmit: string
    readonly statusPending: string
    readonly statusPendingBody: string
    readonly statusRejected: string
    readonly statusSuspended: string
    readonly statusApproved: string
    readonly statusApprovedBody: string
    readonly reviewNote: string
    readonly licenceExpired: string
    readonly missingDocuments: string
    readonly documentsSent: string
    readonly upload: string
    readonly form: {
      readonly licence: string
      readonly licenceNumber: string
      readonly licenceExpiry: string
      readonly vehicle: string
      readonly plate: string
      readonly typeCar: string
      readonly typeBus: string
      readonly model: string
      readonly seats: string
      readonly city: string
      readonly cityHint: string
      readonly submit: string
      readonly incomplete: string
      readonly expiredLicence: string
    }
    readonly work: string
    readonly openRequests: string
    readonly openRequestsEmpty: string
    readonly openRequestsEmptyBody: string
    readonly outOfCity: string
    readonly passengersCount: string
    readonly takenAlready: string
    readonly offer: string
    readonly offerPrice: string
    readonly offerPriceHint: string
    readonly offerEta: string
    readonly offerEtaHint: string
    readonly offerSubmit: string
    readonly offerDone: string
    readonly offerInvalid: string
    readonly myOffers: string
    readonly myOffersEmpty: string
    readonly offerPending: string
    readonly offerAccepted: string
    readonly offerLost: string
    readonly offerExpired: string
    readonly myRides: string
    readonly myRidesEmpty: string
    readonly currentRide: string
    readonly awaitingPayment: string
    readonly startRide: string
    readonly completeRide: string
    readonly rideStarted: string
    readonly rideDone: string
    readonly earned: string
    readonly earnings: string
    readonly balance: string
    readonly balanceHint: string
    readonly payable: string
    readonly payableHint: string
    readonly belowMinimum: string
    readonly history: string
    readonly historyEmpty: string
    readonly payouts: string
    readonly payoutsEmpty: string
    readonly account: string
    readonly accountNone: string
    readonly accountPending: string
    readonly accountVerified: string
    readonly accountOperator: string
    readonly accountNumber: string
    readonly accountNumberHint: string
    readonly accountName: string
    readonly accountNameHint: string
    readonly accountSubmit: string
    readonly accountReplace: string
    readonly accountIncomplete: string
  }
  readonly tabs: {
    readonly home: string
    readonly trips: string
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
      title: "Où souhaitez-vous aller aujourd'hui ?",
      subtitle: 'Réservez votre trajet en toute sécurité.',
      from: 'Départ',
      to: 'Arrivée',
      date: 'Date',
      today: "Aujourd'hui",
      tomorrow: 'Demain',
      submit: 'Rechercher des trajets',
      swap: 'Inverser départ et arrivée',
      pickCity: 'Choisir une ville',
      fromExample: 'Ex : Douala',
      toExample: 'Ex : Yaoundé',
      passengers: 'Passagers',
      searchCity: 'Ville ou gare',
      noCity: 'Aucune ville trouvée',
      noCityBody: 'Vérifiez l’orthographe, ou essayez le nom de la ville plutôt que celui du quartier.',
      typeMore: 'Saisissez au moins deux lettres',
      sameCity: 'Le départ et l’arrivée doivent être différents',
      greeting: 'Bonjour 👋',
      recent: 'Recherches récentes',
      seeAll: 'Voir tout',
      promo: {
        title: 'Voyagez en toute sérénité',
        body: 'Réservez, payez et obtenez votre billet en quelques clics.',
      },
    },
    results: {
      title: 'Résultats',
      filters: {
        title: 'Filtres',
        agencies: 'Agences',
        vehicle: 'Type de véhicule',
        onlyAvailable: 'Masquer les départs complets',
        departure: 'Heure de départ',
        price: 'Prix',
        bracket: {
          ANY: 'Tous les prix',
          LOW: 'Moins de 5 000 FCFA',
          MID: '5 000 – 10 000 FCFA',
          HIGH: 'Plus de 10 000 FCFA',
        },
        period: {
          ANY: 'Toute la journée',
          MORNING: 'Matin · avant 12 h',
          AFTERNOON: 'Après-midi · 12 h – 18 h',
          EVENING: 'Soir · après 18 h',
        },
        any: 'Tous',
        reset: 'Réinitialiser',
        apply: 'Afficher les résultats',
        active: '{{count}} filtre(s)',
      },
      summary: '{{date}} • {{count}} passager(s)',
      sort: {
        best: 'Meilleur',
        price_asc: 'Prix',
        departure_asc: 'Heure',
        duration_asc: 'Durée',
      },
      choose: 'Choisir',
      // Le gabarit du véhicule est un vrai critère de comparaison : on ne
      // voyage pas cinq heures en berline comme en autocar.
      vehicle: { BUS: 'Autocar', CAR: 'Voiture' },
      seatsLeft: '{{count}} place(s) rest.',
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
      details: 'Détails du trajet',
      date: 'Date',
      busType: 'Type de bus',
      capacity: 'Capacité',
      available: 'Disponibles',
      seatsUnit: '{{count}} places',
      pricePerPassenger: 'Prix par passager',
      selectedSeats: 'Places sélectionnées',
      total: 'Total',
      choose: 'Choisir ce trajet',
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
      title: 'Informations passagers',
      subtitle: 'Renseignez les détails de chaque voyageur.',
      mainPassenger: 'Passager principal',
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
      summary: 'Récapitulatif de la commande',
      agency: 'Agence',
      route: 'Trajet',
      seats: 'Places',
      total: 'Total',
      totalToPay: 'Total à payer',
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
        title: 'Paiement réussi !',
        body: 'Votre réservation a été confirmée.',
        reference: 'Numéro de réservation',
        // La maquette annonce « un e-mail et un SMS » ; seul le SMS existe.
        notified: 'Un SMS de confirmation vous a été envoyé.',
        seeTicket: 'Voir mon billet',
        home: 'Retour à l’accueil',
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
      listSubtitle: 'Gérez vos trajets et accédez à vos QR codes.',
      upcoming: 'Trajets à venir',
      history: 'Historique',
      seeQr: 'Voir le QR code',
      seeTicket: 'Voir le billet',
      seats: 'Places',
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
      confirmed: 'Voyage confirmé !',
      agency: 'Agence',
      origin: 'Départ',
      destination: 'Destination',
      date: 'Date',
      time: 'Heure',
    },
    account: {
      title: 'Compte',
      signIn: 'Se connecter',
      signUp: 'Créer un compte',
      phone: 'Téléphone',
      phoneHint: 'Au format international, par exemple +237690000000.',
      firstName: 'Prénom',
      lastName: 'Nom',
      continue: 'Continuer',
      noAccount: 'Pas encore de compte ?',
      haveAccount: 'J’ai déjà un compte',
      signOut: 'Se déconnecter',
      history: 'Mes voyages',
      historyEmpty: 'Aucun voyage pour le moment.',
      // La connexion n'est demandée qu'au dernier moment, une fois les places
      // choisies : l'exiger d'entrée ferait renoncer quelqu'un qui veut
      // seulement savoir s'il y a un car ce soir (§35).
      whyNeeded: 'Un compte est nécessaire pour finaliser la réservation.',
      tagline: 'Déplacez-vous en toute confiance.',
      welcome: 'Bienvenue 👋',
      signUpBody: 'Remplissez les informations ci-dessous.',
      emailOptional: 'E-mail (facultatif)',
      authBody: 'Saisissez votre numéro pour continuer. Un code de vérification vous sera envoyé par SMS.',
      language: 'Langue',
      languageName: 'Français (Cameroun)',
      historyHint: 'Consultez vos trajets passés et vos reçus',
      sectionAccount: 'Compte',
      sectionPreferences: 'Préférences',
      settings: 'Paramètres',
      sectionSupport: 'Support',
      currency: 'Devise',
      about: 'À propos de MOTOBOY',
      languageFr: 'Français',
      languageEn: 'Anglais',
      otp: {
        title: 'Code de vérification',
        sentTo: 'Un code a été envoyé au {{phone}}.',
        instruction: 'Entrez le code à {{count}} chiffres envoyé par SMS au',
        codeField: 'Code de vérification',
        code: 'Code reçu',
        verify: 'Valider',
        resend: 'Renvoyer le code',
        // Chaque envoi coûte un SMS, et l'OTP est le seul canal sans
        // alternative : le renvoi attend, plutôt que d'inviter à insister (I8).
        resendIn: 'Renvoyer dans {{seconds}} s',
        attemptsLeft: '{{count}} tentative(s) restante(s)',
        expired: 'Ce code a expiré. Demandez-en un nouveau.',
      },
    },
    cancellation: {
      title: 'Annuler',
      whoLeaves: 'Qui n’embarque pas ?',
      // L'annulation partielle est supportée dès le MVP : trois places
      // réservées, une annulée (B5).
      all: 'Tout le monde',
      refundable: 'Vous récupérez',
      fee: 'Frais d’annulation',
      free: 'Aucun frais',
      deadline: 'Annulable jusqu’au {{date}}',
      // Le remboursement part toujours vers le compte source du paiement,
      // jamais vers un numéro déclaré après coup (B5).
      toSource: 'Le remboursement retournera sur le compte qui a payé.',
      counterSale:
        'Cette réservation a été payée en espèces au guichet : le remboursement se fait sur place, auprès de l’agence.',
      confirm: 'Confirmer l’annulation',
      refused: {
        deadlinePassed: 'Le délai d’annulation est dépassé pour ce départ.',
        notCancellable: 'Cette réservation ne peut pas être annulée.',
      },
      done: {
        title: 'Annulation enregistrée',
        refunded: '{{amount}} vous seront remboursés.',
        noRefund: 'Aucun remboursement par l’application.',
        pending: 'Le remboursement est en cours auprès de votre opérateur.',
        close: 'Terminer',
      },
    },
    steps: { seats: 'Places', details: 'Infos', payment: 'Paiement' },
    serviceCall: {
      entry: 'Besoin d’un véhicule ?',
      entryHint: 'Un chauffeur vient vous chercher',
      title: 'Appel de service',
      subtitle: 'Dites où vous êtes et où vous allez. Des chauffeurs vous proposent un prix.',
      from: 'Je suis à',
      to: 'Je vais à',
      landmark: 'Point de repère',
      // Sans repère, un chauffeur qui accepte ne sait pas où se rendre : la
      // ville ne suffit pas à se retrouver.
      landmarkHint: 'Ex : carrefour Total, marché central',
      landmarkOptional: 'Point de repère (facultatif)',
      passengers: 'Voyageurs',
      note: 'Précision pour le chauffeur',
      noteHint: 'Bagages, heure souhaitée, autre chose à savoir',
      submit: 'Envoyer la demande',
      sameCity: 'Le départ et l’arrivée doivent être différents',
      missingLandmark: 'Indiquez où vous attendre',
      waiting: 'En attente d’offres',
      waitingBody: 'Les chauffeurs de votre ville voient votre demande. Elle expire dans trente minutes.',
      offers: 'Offres reçues',
      eta: 'sur place dans {{minutes}} min',
      accept: 'Retenir cette offre',
      expired: 'Demande expirée',
      expiredBody: 'Personne n’a répondu à temps. Vous pouvez en lancer une autre.',
      matched: 'Chauffeur trouvé',
      matchedBody: 'Payez pour confirmer, puis retrouvez-le au point indiqué.',
      driver: 'Chauffeur',
      plate: 'Plaque',
      meetAt: 'Rendez-vous',
      pay: 'Payer la course',
      paying: 'Paiement en cours…',
      paid: 'Course confirmée',
      noShow: 'Le chauffeur n’est pas venu',
      noShowConfirm: 'Vous serez remboursé intégralement.',
      cancel: 'Annuler la demande',
      cancelled: 'Demande annulée',
      inProgress: 'Course en cours',
      completed: 'Course terminée',
    },
    driver: {
      title: 'Mode chauffeur',
      pitchTitle: 'Conduire avec MOTOBOY',
      pitchBody: 'Vous voyez les demandes de votre ville, vous proposez votre prix. Le passager paie sur la plateforme, vous êtes reversé sur votre compte Mobile Money.',
      requires: 'Ce qu’il faut fournir',
      requiresLicence: 'Permis de conduire en cours de validité',
      requiresRegistration: 'Carte grise du véhicule',
      requiresIdentity: 'Pièce d’identité',
      requiresInsurance: 'Attestation d’assurance',
      start: 'Déposer mon dossier',
      resubmit: 'Corriger et représenter',
      statusPending: 'Dossier en cours d’examen',
      statusPendingBody: 'Nous revenons vers vous dès qu’une décision est prise.',
      statusRejected: 'Dossier refusé',
      statusSuspended: 'Compte suspendu',
      statusApproved: 'Dossier validé',
      statusApprovedBody: 'Vous pouvez répondre aux demandes de votre ville.',
      reviewNote: 'Motif',
      licenceExpired: 'Votre permis est périmé. Redéposez-le pour reprendre les courses.',
      missingDocuments: 'Pièces manquantes',
      documentsSent: 'Pièces déposées',
      upload: 'Déposer',
      form: {
        licence: 'Permis',
        licenceNumber: 'Numéro de permis',
        licenceExpiry: 'Expire le',
        vehicle: 'Véhicule',
        plate: 'Plaque',
        typeCar: 'Voiture',
        typeBus: 'Bus',
        model: 'Modèle',
        seats: 'Places',
        city: 'Ville d’exercice',
        cityHint: 'Vous verrez les demandes de cette ville.',
        submit: 'Envoyer le dossier',
        incomplete: 'Complétez les champs obligatoires.',
        expiredLicence: 'La date d’expiration doit être à venir.',
      },
      work: 'Conduire',
      openRequests: 'Demandes ouvertes',
      openRequestsEmpty: 'Aucune demande pour l’instant',
      openRequestsEmptyBody: 'Les demandes de votre ville apparaissent ici. Tirez pour rafraîchir.',
      outOfCity: 'Aucune demande dans votre ville d’exercice.',
      passengersCount: '{{count}} personne(s)',
      takenAlready: 'Cette demande vient d’être pourvue.',
      offer: 'Faire une offre',
      offerPrice: 'Votre prix',
      offerPriceHint: 'Ferme, pour la course entière.',
      offerEta: 'Délai d’arrivée',
      offerEtaHint: 'En minutes, depuis maintenant.',
      offerSubmit: 'Envoyer l’offre',
      offerDone: 'Offre envoyée',
      offerInvalid: 'Renseignez un prix et un délai.',
      myOffers: 'Mes offres',
      myOffersEmpty: 'Vous n’avez encore rien proposé.',
      offerPending: 'En attente',
      offerAccepted: 'Acceptée',
      offerLost: 'Non retenue',
      offerExpired: 'Expirée',
      myRides: 'Mes courses',
      myRidesEmpty: 'Aucune course pour l’instant.',
      currentRide: 'Course en cours',
      awaitingPayment: 'En attente du paiement du passager',
      startRide: 'Démarrer la course',
      completeRide: 'Terminer la course',
      rideStarted: 'Course démarrée',
      rideDone: 'Course terminée',
      earned: 'Vous touchez',
      earnings: 'Mes revenus',
      balance: 'Solde',
      balanceHint: 'Tout ce qui vous est dû, reversable ou non.',
      payable: 'Reversable',
      payableHint: 'Une course devient reversable {{hours}} h après sa fin.',
      belowMinimum: 'Le virement partira à partir de {{amount}}.',
      history: 'Détail',
      historyEmpty: 'Aucun mouvement pour l’instant.',
      payouts: 'Reversements',
      payoutsEmpty: 'Aucun virement encore.',
      account: 'Compte de versement',
      accountNone: 'Renseignez où verser votre argent.',
      accountPending: 'En cours de vérification',
      accountVerified: 'Vérifié',
      accountOperator: 'Opérateur',
      accountNumber: 'Numéro Mobile Money',
      accountNumberHint: 'Le numéro qui recevra les virements.',
      accountName: 'Nom du titulaire',
      accountNameHint: 'Tel qu’il apparaît sur le compte.',
      accountSubmit: 'Enregistrer',
      accountReplace: 'Changer de compte',
      accountIncomplete: 'Renseignez le numéro et le nom du titulaire.',
    },
    tabs: {
      home: 'Accueil',
      trips: 'Mes voyages',
      tickets: 'Mes billets',
      account: 'Profil',
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
      title: 'Where are you going today?',
      subtitle: 'Book your trip with confidence.',
      from: 'From',
      to: 'To',
      date: 'Date',
      today: 'Today',
      tomorrow: 'Tomorrow',
      submit: 'Search trips',
      swap: 'Swap origin and destination',
      pickCity: 'Pick a city',
      fromExample: 'e.g. Douala',
      toExample: 'e.g. Yaoundé',
      passengers: 'Passengers',
      searchCity: 'City or station',
      noCity: 'No city found',
      noCityBody: 'Check the spelling, or try the city name rather than the neighbourhood.',
      typeMore: 'Type at least two letters',
      sameCity: 'Origin and destination must differ',
      greeting: 'Hello 👋',
      recent: 'Recent searches',
      seeAll: 'See all',
      promo: {
        title: 'Travel with peace of mind',
        body: 'Book, pay and get your ticket in a few taps.',
      },
    },
    results: {
      title: 'Results',
      filters: {
        title: 'Filters',
        agencies: 'Agencies',
        vehicle: 'Vehicle type',
        onlyAvailable: 'Hide sold-out departures',
        departure: 'Departure time',
        price: 'Price',
        bracket: {
          ANY: 'Any price',
          LOW: 'Under 5,000 FCFA',
          MID: '5,000 – 10,000 FCFA',
          HIGH: 'Over 10,000 FCFA',
        },
        period: {
          ANY: 'Any time',
          MORNING: 'Morning · before 12',
          AFTERNOON: 'Afternoon · 12–18',
          EVENING: 'Evening · after 18',
        },
        any: 'Any',
        reset: 'Reset',
        apply: 'Show results',
        active: '{{count}} filter(s)',
      },
      summary: '{{date}} • {{count}} passenger(s)',
      sort: {
        best: 'Best',
        price_asc: 'Price',
        departure_asc: 'Time',
        duration_asc: 'Duration',
      },
      choose: 'Choose',
      vehicle: { BUS: 'Coach', CAR: 'Car' },
      seatsLeft: '{{count}} seat(s) left',
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
      details: 'Trip details',
      date: 'Date',
      busType: 'Vehicle',
      capacity: 'Capacity',
      available: 'Available',
      seatsUnit: '{{count}} seats',
      pricePerPassenger: 'Price per passenger',
      selectedSeats: 'Selected seats',
      total: 'Total',
      choose: 'Choose this trip',
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
      title: 'Passenger details',
      subtitle: 'Fill in the details for each traveller.',
      mainPassenger: 'Main passenger',
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
      summary: 'Order summary',
      agency: 'Agency',
      route: 'Route',
      seats: 'Seats',
      total: 'Total',
      totalToPay: 'Total to pay',
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
        title: 'Payment successful!',
        body: 'Your booking is confirmed.',
        reference: 'Booking reference',
        notified: 'A confirmation SMS has been sent to you.',
        seeTicket: 'View my ticket',
        home: 'Back to home',
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
      listSubtitle: 'Your trips and their QR codes.',
      upcoming: 'Upcoming trips',
      history: 'History',
      seeQr: 'Show QR code',
      seeTicket: 'View ticket',
      seats: 'Seats',
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
      confirmed: 'Trip confirmed!',
      agency: 'Agency',
      origin: 'From',
      destination: 'To',
      date: 'Date',
      time: 'Time',
    },
    account: {
      title: 'Account',
      signIn: 'Sign in',
      signUp: 'Create an account',
      phone: 'Phone',
      phoneHint: 'International format, for example +237690000000.',
      firstName: 'First name',
      lastName: 'Last name',
      continue: 'Continue',
      noAccount: 'No account yet?',
      haveAccount: 'I already have an account',
      signOut: 'Sign out',
      history: 'My trips',
      historyEmpty: 'No trips yet.',
      whyNeeded: 'An account is needed to complete the booking.',
      tagline: 'Travel with confidence.',
      welcome: 'Welcome 👋',
      signUpBody: 'Fill in the details below.',
      emailOptional: 'Email (optional)',
      authBody: 'Enter your number to continue. We will text you a verification code.',
      language: 'Language',
      languageName: 'English (Cameroon)',
      historyHint: 'Your past trips and receipts',
      sectionAccount: 'Account',
      sectionPreferences: 'Preferences',
      settings: 'Settings',
      sectionSupport: 'Support',
      currency: 'Currency',
      about: 'About MOTOBOY',
      languageFr: 'French',
      languageEn: 'English',
      otp: {
        title: 'Verification code',
        sentTo: 'A code was sent to {{phone}}.',
        instruction: 'Enter the {{count}}-digit code sent by SMS to',
        codeField: 'Verification code',
        code: 'Code received',
        verify: 'Verify',
        resend: 'Resend the code',
        resendIn: 'Resend in {{seconds}}s',
        attemptsLeft: '{{count}} attempt(s) left',
        expired: 'This code has expired. Ask for a new one.',
      },
    },
    cancellation: {
      title: 'Cancel',
      whoLeaves: 'Who is not travelling?',
      all: 'Everyone',
      refundable: 'You get back',
      fee: 'Cancellation fee',
      free: 'No fee',
      deadline: 'Cancellable until {{date}}',
      toSource: 'The refund will go back to the account that paid.',
      counterSale:
        'This booking was paid in cash at the counter: the refund is handled there, by the agency.',
      confirm: 'Confirm cancellation',
      refused: {
        deadlinePassed: 'The cancellation deadline has passed for this departure.',
        notCancellable: 'This booking cannot be cancelled.',
      },
      done: {
        title: 'Cancellation recorded',
        refunded: '{{amount}} will be refunded to you.',
        noRefund: 'No refund through the app.',
        pending: 'The refund is being processed by your operator.',
        close: 'Done',
      },
    },
    steps: { seats: 'Seats', details: 'Details', payment: 'Payment' },
    serviceCall: {
      entry: 'Need a vehicle?',
      entryHint: 'A driver comes to pick you up',
      title: 'Service call',
      subtitle: 'Say where you are and where you are going. Drivers quote you a price.',
      from: 'I am at',
      to: 'I am going to',
      landmark: 'Landmark',
      landmarkHint: 'e.g. Total junction, central market',
      landmarkOptional: 'Landmark (optional)',
      passengers: 'Travellers',
      note: 'Anything the driver should know',
      noteHint: 'Luggage, preferred time, anything else',
      submit: 'Send the request',
      sameCity: 'Origin and destination must differ',
      missingLandmark: 'Say where to meet you',
      waiting: 'Waiting for offers',
      waitingBody: 'Drivers in your city can see your request. It expires in thirty minutes.',
      offers: 'Offers received',
      eta: 'there in {{minutes}} min',
      accept: 'Take this offer',
      expired: 'Request expired',
      expiredBody: 'Nobody answered in time. You can send another.',
      matched: 'Driver found',
      matchedBody: 'Pay to confirm, then meet them at the agreed spot.',
      driver: 'Driver',
      plate: 'Plate',
      meetAt: 'Meeting point',
      pay: 'Pay for the ride',
      paying: 'Payment in progress…',
      paid: 'Ride confirmed',
      noShow: 'The driver never came',
      noShowConfirm: 'You will be refunded in full.',
      cancel: 'Cancel the request',
      cancelled: 'Request cancelled',
      inProgress: 'Ride in progress',
      completed: 'Ride completed',
    },
    driver: {
      title: 'Driver mode',
      pitchTitle: 'Drive with MOTOBOY',
      pitchBody: 'You see the requests in your city and name your price. The passenger pays on the platform, and you are paid out to your Mobile Money account.',
      requires: 'What you need to provide',
      requiresLicence: 'A valid driving licence',
      requiresRegistration: 'Vehicle registration',
      requiresIdentity: 'Proof of identity',
      requiresInsurance: 'Insurance certificate',
      start: 'Submit my application',
      resubmit: 'Fix and resubmit',
      statusPending: 'Application under review',
      statusPendingBody: 'We will get back to you as soon as a decision is made.',
      statusRejected: 'Application rejected',
      statusSuspended: 'Account suspended',
      statusApproved: 'Application approved',
      statusApprovedBody: 'You can now answer requests in your city.',
      reviewNote: 'Reason',
      licenceExpired: 'Your licence has expired. Submit a new one to take rides again.',
      missingDocuments: 'Missing documents',
      documentsSent: 'Documents provided',
      upload: 'Upload',
      form: {
        licence: 'Licence',
        licenceNumber: 'Licence number',
        licenceExpiry: 'Expires on',
        vehicle: 'Vehicle',
        plate: 'Plate',
        typeCar: 'Car',
        typeBus: 'Bus',
        model: 'Model',
        seats: 'Seats',
        city: 'City you work in',
        cityHint: 'You will see requests from this city.',
        submit: 'Send application',
        incomplete: 'Fill in the required fields.',
        expiredLicence: 'The expiry date must be in the future.',
      },
      work: 'Drive',
      openRequests: 'Open requests',
      openRequestsEmpty: 'No requests right now',
      openRequestsEmptyBody: 'Requests from your city show up here. Pull to refresh.',
      outOfCity: 'No requests in the city you work in.',
      passengersCount: '{{count}} passenger(s)',
      takenAlready: 'This request has just been taken.',
      offer: 'Make an offer',
      offerPrice: 'Your price',
      offerPriceHint: 'Firm, for the whole ride.',
      offerEta: 'Time to arrive',
      offerEtaHint: 'In minutes, from now.',
      offerSubmit: 'Send offer',
      offerDone: 'Offer sent',
      offerInvalid: 'Enter a price and a time.',
      myOffers: 'My offers',
      myOffersEmpty: 'You have not made any offer yet.',
      offerPending: 'Pending',
      offerAccepted: 'Accepted',
      offerLost: 'Not taken',
      offerExpired: 'Expired',
      myRides: 'My rides',
      myRidesEmpty: 'No rides yet.',
      currentRide: 'Current ride',
      awaitingPayment: 'Waiting for the passenger to pay',
      startRide: 'Start the ride',
      completeRide: 'Complete the ride',
      rideStarted: 'Ride started',
      rideDone: 'Ride completed',
      earned: 'You receive',
      earnings: 'My earnings',
      balance: 'Balance',
      balanceHint: 'Everything owed to you, payable or not.',
      payable: 'Payable',
      payableHint: 'A ride becomes payable {{hours}} h after it ends.',
      belowMinimum: 'A transfer goes out from {{amount}} upwards.',
      history: 'Breakdown',
      historyEmpty: 'No movement yet.',
      payouts: 'Payouts',
      payoutsEmpty: 'No transfer yet.',
      account: 'Payout account',
      accountNone: 'Tell us where to send your money.',
      accountPending: 'Being verified',
      accountVerified: 'Verified',
      accountOperator: 'Operator',
      accountNumber: 'Mobile Money number',
      accountNumberHint: 'The number that will receive transfers.',
      accountName: 'Account holder',
      accountNameHint: 'As it appears on the account.',
      accountSubmit: 'Save',
      accountReplace: 'Change account',
      accountIncomplete: 'Enter the number and the account holder.',
    },
    tabs: {
      home: 'Home',
      trips: 'My trips',
      tickets: 'My tickets',
      account: 'Profile',
    },
  },
}
