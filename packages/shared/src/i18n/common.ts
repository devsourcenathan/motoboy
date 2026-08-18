import type { Locale } from '../locale.js'

/**
 * Catalogue commun aux deux applications.
 *
 * **Ce qui vit ici** : ce qu'un passager et un agent lisent à l'identique —
 * actions, états d'attente, messages de validation de formulaire, unités. Ces
 * chaînes reviennent sur presque chaque écran, et les écrire deux fois garantit
 * qu'une traduction manquera d'un côté.
 *
 * **Ce qui n'y vit pas** : les textes propres à un écran. Le parcours passager
 * et le back-office d'agence ne partagent presque rien — un catalogue unique
 * deviendrait un dépotoir où l'on ne saurait plus quelle chaîne sert encore. Le
 * vocabulaire métier, lui, est déjà dans `labels.ts`.
 *
 * Le type croisé `Record<Locale, CommonMessages>` fait travailler le
 * compilateur dans les deux dimensions : ajouter une clé casse la compilation
 * **dans chaque langue** tant que la traduction manque, et ajouter une langue
 * casse partout. C'est le même anti-dérive que pour les libellés d'énumération.
 */
export interface CommonMessages {
  readonly action: {
    readonly back: string
    readonly cancel: string
    readonly close: string
    readonly delete: string
    readonly confirm: string
    readonly continue: string
    readonly retry: string
    readonly save: string
    readonly search: string
    readonly share: string
  }
  readonly state: {
    readonly empty: string
    readonly loading: string
    /** Réseau absent — distinct d'une erreur du serveur, qui a son code. */
    readonly offline: string
    readonly unexpected: string
  }
  readonly validation: {
    readonly required: string
    readonly invalidPhone: string
    readonly invalidEmail: string
    readonly tooShort: string
    readonly tooLong: string
  }
  readonly unit: {
    readonly seats: PluralForms
    readonly minutes: PluralForms
    readonly hours: PluralForms
  }
}

/**
 * Les deux formes, explicitement.
 *
 * Le pluriel n'est pas délégué au moteur i18n : les deux applications n'ont pas
 * le même, et une chaîne qui ne vaut que branchée à i18next cesse d'être
 * utilisable partout ailleurs — un message d'accessibilité, un partage de
 * billet. `{{count}}` est interpolé par l'appelant.
 *
 * Deux formes suffisent au français et à l'anglais. Une langue à trois formes
 * imposerait d'élargir ce type, ce qui casserait la compilation partout — c'est
 * l'effet voulu.
 */
export interface PluralForms {
  readonly one: string
  readonly other: string
}

export const commonMessages: Record<Locale, CommonMessages> = {
  fr: {
    action: {
      back: 'Retour',
      cancel: 'Annuler',
      close: 'Fermer',
      delete: 'Effacer',
      confirm: 'Confirmer',
      continue: 'Continuer',
      retry: 'Réessayer',
      save: 'Enregistrer',
      search: 'Rechercher',
      share: 'Partager',
    },
    state: {
      empty: 'Aucun résultat',
      loading: 'Chargement…',
      offline: 'Pas de connexion. Vérifiez votre réseau.',
      unexpected: 'Une erreur inattendue est survenue.',
    },
    validation: {
      required: 'Ce champ est obligatoire',
      invalidPhone: 'Numéro de téléphone invalide',
      invalidEmail: 'Adresse e-mail invalide',
      tooShort: 'Trop court',
      tooLong: 'Trop long',
    },
    unit: {
      seats: { one: '{{count}} place', other: '{{count}} places' },
      minutes: { one: '{{count}} minute', other: '{{count}} minutes' },
      hours: { one: '{{count}} heure', other: '{{count}} heures' },
    },
  },
  en: {
    action: {
      back: 'Back',
      cancel: 'Cancel',
      close: 'Close',
      delete: 'Delete',
      confirm: 'Confirm',
      continue: 'Continue',
      retry: 'Try again',
      save: 'Save',
      search: 'Search',
      share: 'Share',
    },
    state: {
      empty: 'No results',
      loading: 'Loading…',
      offline: 'No connection. Check your network.',
      unexpected: 'Something went wrong.',
    },
    validation: {
      required: 'This field is required',
      invalidPhone: 'Invalid phone number',
      invalidEmail: 'Invalid email address',
      tooShort: 'Too short',
      tooLong: 'Too long',
    },
    unit: {
      seats: { one: '{{count}} seat', other: '{{count}} seats' },
      minutes: { one: '{{count}} minute', other: '{{count}} minutes' },
      hours: { one: '{{count}} hour', other: '{{count}} hours' },
    },
  },
}
