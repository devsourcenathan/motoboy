import type { Locale } from '@motoboy/shared'

/**
 * Textes des écrans du parcours passager.
 *
 * **Propres à cette application**, par opposition au vocabulaire métier
 * (`labels.ts`) et aux chaînes communes (`messages.ts`) de `@motoboy/shared`.
 * Le back-office d'agence et le parcours passager ne partagent presque rien :
 * les fondre dans un catalogue unique produirait un dépotoir où l'on ne saurait
 * plus quelle chaîne sert encore.
 *
 * Le type croisé `Record<Locale, ScreenMessages>` fait travailler le
 * compilateur dans les deux dimensions : une clé ajoutée casse la compilation
 * tant qu'elle manque **dans une langue**. Le Cameroun est bilingue, et une
 * interface conçue en une seule langue se réécrit pour en accueillir une
 * seconde.
 */
export interface ScreenMessages {
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
    readonly submit: string
    readonly swap: string
    readonly pickCity: string
    readonly noCity: string
  }
  readonly tabs: {
    readonly search: string
    readonly tickets: string
    readonly account: string
  }
}

export const screenMessages: Record<Locale, ScreenMessages> = {
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
      submit: 'Rechercher',
      swap: 'Inverser',
      pickCity: 'Choisir une ville',
      noCity: 'Aucune ville trouvée',
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
      submit: 'Search',
      swap: 'Swap',
      pickCity: 'Pick a city',
      noCity: 'No city found',
    },
    tabs: {
      search: 'Search',
      tickets: 'My tickets',
      account: 'Account',
    },
  },
}
