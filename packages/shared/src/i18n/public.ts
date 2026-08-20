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
  },
}
