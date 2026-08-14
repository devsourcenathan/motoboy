<?php

declare(strict_types=1);

/*
 * Contenu généré par le serveur, donc localisé côté serveur (I10) : la langue
 * dépend du destinataire — `users.locale`, ou la langue par défaut de l'agence
 * pour un passager de vente au guichet, qui n'a pas de compte.
 *
 * Aucune chaîne visible n'est écrite en dur dans le code.
 *
 * ⚠️ **Sans accents, délibérément.** Un seul caractère hors GSM-7 bascule le
 * message en UCS-2 et fait tomber la limite de 160 à 70 caractères : le SMS
 * compte alors double, ou triple. Sur l'annulation d'un départ, il part vers
 * plusieurs dizaines de passagers d'un coup.
 */

return [
    'otp' => 'MOTOBOY : votre code est :code. Il expire dans :minutes minutes. Ne le communiquez a personne.',
    'counter_ticket' => 'MOTOBOY : votre reservation :reference est confirmee (:count billet(s)). Presentez ce code a l\'embarquement.',
    'trip_cancelled' => 'MOTOBOY : depart du :date annule. Reservation :reference remboursee integralement. Alternatives dans l\'application.',
    'payout_account_changed' => 'MOTOBOY : une demande de changement de vos coordonnees de reversement a ete enregistree. Si ce n est pas vous, contactez-nous immediatement.',
];
