<?php

declare(strict_types=1);

/*
 * Contenu généré par le serveur, donc localisé côté serveur (I10) : la langue
 * dépend du destinataire — `users.locale`, ou la langue par défaut de l'agence
 * pour un passager de vente au guichet, qui n'a pas de compte.
 *
 * Aucune chaîne visible n'est écrite en dur dans le code.
 */

return [
    'otp' => 'MOTOBOY : votre code est :code. Il expire dans :minutes minutes. Ne le communiquez à personne.',
    // Sans accents volontairement : un seul caractère hors GSM-7 bascule le SMS
    // en UCS-2 et fait tomber la limite de 160 à 70 caractères, donc double le
    // coût d'un message que la plateforme paie sans commission en face (I2).
    'counter_ticket' => 'MOTOBOY : votre reservation :reference est confirmee (:count billet(s)). Presentez ce code a l\'embarquement.',
];
