import type { Locale } from '../locale.js'

/**
 * Le comparateur public.
 *
 * **C'est la surface qui décide du marché, pas seulement du confort.** Le brief
 * ([I10]) tranche : le Cameroun a deux langues officielles, et les régions du
 * Nord-Ouest et du Sud-Ouest sont anglophones. Bamenda, Buea et Limbe sont des
 * destinations interurbaines réelles, Douala–Bamenda un axe fréquenté. Un
 * comparateur uniquement francophone n'ampute donc pas « les autres pays plus
 * tard » : il ampute une part du marché de lancement, et l'ampute par défaut.
 *
 * Catalogue séparé de celui du passager mobile : les deux surfaces parlent au
 * même public mais pas au même moment. Le web informe et compare ; l'application
 * vend. Les fondre rendrait indistinct ce que chacune promet.
 *
 * Le type croisé `Record<Locale, PublicMessages>` fait travailler le compilateur
 * dans les deux dimensions — ajouter une clé casse la compilation dans chaque
 * langue tant que la traduction manque.
 */
export interface PublicMessages {
  readonly hero: {
    readonly tagline: string
    /**
     * L'entrée des professionnels.
     *
     * Discrète, mais **présente** : sans elle, un gérant d'agence n'a aucun
     * moyen de trouver son espace depuis le site — il faudrait connaître l'URL.
     */
    readonly proAccess: string
  }
  readonly search: {
    readonly from: string
    readonly to: string
    readonly date: string
    readonly travellers: string
    readonly submit: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly view: string
    /** Les places **restantes**, jamais la capacité : c'est ce qui décide. */
    readonly seatsLeft: string
  }
  readonly trip: {
    readonly originStation: string
    readonly destinationStation: string
    readonly price: string
    readonly seatsLeft: string
    /**
     * **Le web ne vend pas.** Le dire évite qu'on cherche un bouton
     * « réserver » qui n'existe pas.
     */
    readonly bookOnApp: string
    readonly holdNotice: string
  }
  /**
   * La candidature d'une agence.
   *
   * **C'est la porte d'entrée du côté offre**, et elle n'existait pas : l'API
   * l'acceptait, aucun écran ne l'appelait. Une agence qui voulait rejoindre la
   * plateforme n'avait littéralement nulle part où le dire.
   */
  readonly join: {
    readonly link: string
    readonly title: string
    readonly lede: string
    readonly agencySection: string
    readonly name: string
    readonly legalName: string
    readonly phone: string
    readonly email: string
    readonly managerSection: string
    /** Ce numéro devient un compte : il faut le dire avant qu'on le saisisse. */
    readonly managerNotice: string
    readonly managerFirstName: string
    readonly managerLastName: string
    readonly managerPhone: string
    readonly submit: string
    readonly codeTitle: string
    readonly codeSent: string
    readonly code: string
    readonly verify: string
    /** Ce qui se passe ensuite, pour ne pas laisser attendre sans savoir quoi. */
    readonly afterwards: string
  }
  readonly notFound: {
    readonly title: string
    readonly body: string
    readonly home: string
  }
}

export const publicMessages: Record<Locale, PublicMessages> = {
  fr: {
    hero: {
      tagline: 'Comparez les départs de toutes les agences, sur un seul écran.',
      proAccess: 'Espace professionnel',
    },
    search: {
      from: 'Départ',
      to: 'Arrivée',
      date: 'Date',
      travellers: 'Voyageurs',
      submit: 'Chercher',
      emptyTitle: 'Aucun départ ce jour-là',
      emptyBody: 'Essayez une date proche, ou une autre ville de la même région.',
      view: 'Voir',
      seatsLeft: '{{count}} place restante',
    },
    trip: {
      originStation: 'Gare de départ',
      destinationStation: 'Gare d’arrivée',
      price: 'Prix',
      seatsLeft: 'Places restantes',
      bookOnApp: 'La réservation et le paiement se font depuis l’application MOTOBOY.',
      holdNotice:
        'Réservez depuis l’application MOTOBOY — la place n’est tenue qu’une fois la réservation faite.',
    },
    join: {
      link: 'Inscrire mon agence',
      title: 'Inscrire votre agence',
      lede: 'Vos départs apparaîtront dans la recherche une fois votre dossier validé par MOTOBOY.',
      agencySection: 'L’agence',
      name: 'Nom commercial',
      legalName: 'Raison sociale (facultatif)',
      phone: 'Téléphone de l’agence',
      email: 'Email (facultatif)',
      managerSection: 'Le responsable',
      managerNotice:
        'Ce numéro devient le compte qui gérera l’agence. Il recevra un code par SMS dans un instant.',
      managerFirstName: 'Prénom',
      managerLastName: 'Nom',
      managerPhone: 'Son téléphone',
      submit: 'Envoyer la candidature',
      codeTitle: 'Confirmez le numéro',
      codeSent: 'Un code vient de partir par SMS au responsable.',
      code: 'Code reçu',
      verify: 'Confirmer',
      afterwards:
        'Votre espace s’ouvre immédiatement : déposez vos pièces, déclarez vos gares et vos véhicules. MOTOBOY instruit le dossier ensuite, et c’est l’admission qui fait apparaître vos départs dans la recherche.',
    },
    notFound: {
      title: 'Cette page n’existe pas',
      body: 'Le lien est peut-être périmé, ou l’adresse mal recopiée.',
      home: 'Revenir à la recherche',
    },
  },
  en: {
    hero: {
      tagline: 'Compare departures from every agency, on one screen.',
      proAccess: 'Staff sign-in',
    },
    search: {
      from: 'From',
      to: 'To',
      date: 'Date',
      travellers: 'Travellers',
      submit: 'Search',
      emptyTitle: 'No departures that day',
      emptyBody: 'Try a nearby date, or another town in the same region.',
      view: 'View',
      seatsLeft: '{{count}} seat left',
    },
    trip: {
      originStation: 'Departure station',
      destinationStation: 'Arrival station',
      price: 'Price',
      seatsLeft: 'Seats left',
      bookOnApp: 'Booking and payment happen in the MOTOBOY app.',
      holdNotice:
        'Book from the MOTOBOY app — a seat is only held once the booking is made.',
    },
    join: {
      link: 'Register my agency',
      title: 'Register your agency',
      lede: 'Your departures appear in search once MOTOBOY has reviewed your application.',
      agencySection: 'The agency',
      name: 'Trading name',
      legalName: 'Registered name (optional)',
      phone: 'Agency phone',
      email: 'Email (optional)',
      managerSection: 'The manager',
      managerNotice:
        'This number becomes the account that runs the agency. It will receive a code by SMS in a moment.',
      managerFirstName: 'First name',
      managerLastName: 'Last name',
      managerPhone: 'Their phone',
      submit: 'Send the application',
      codeTitle: 'Confirm the number',
      codeSent: 'A code has just been sent by SMS to the manager.',
      code: 'Code received',
      verify: 'Confirm',
      afterwards:
        'Your space opens right away: file your documents, declare your stations and vehicles. MOTOBOY reviews the application afterwards, and it is that approval which puts your departures in search.',
    },
    notFound: {
      title: 'This page does not exist',
      body: 'The link may be stale, or the address mistyped.',
      home: 'Back to search',
    },
  },
}
