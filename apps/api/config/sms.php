<?php

declare(strict_types=1);

use App\Modules\Notifications\Senders\LogSmsSender;

return [

    /*
     * Pilote actif.
     *
     * TechSoft SMS est le prestataire retenu, mais sa documentation
     * (app.techsoft-sms.com/developers/docs) est derrière une authentification :
     * le schéma exact des requêtes reste à obtenir. Écrire l'adaptateur en
     * devinant produirait une intégration fausse et difficile à déboguer.
     *
     * En attendant, le pilote de journalisation permet de développer et de
     * tester tout le parcours d'inscription. Ajouter TechSoft demandera une
     * classe implémentant `SmsSender` et une entrée dans `drivers` ci-dessous —
     * aucun appelant ne changera.
     */
    'driver' => env('SMS_DRIVER', 'log'),

    'drivers' => [
        'log' => LogSmsSender::class,
    ],

    /*
     * Le SMS coûte de l'argent, et l'OTP est le seul canal sans alternative
     * (I8). Ces bornes ne sont donc pas seulement anti-abus : sans elles, un
     * script qui redemande un code en boucle vide le budget SMS.
     */
    'throttle' => [
        'per_phone_per_hour' => env('SMS_MAX_PER_PHONE_PER_HOUR', 5),
        'resend_cooldown_seconds' => env('SMS_RESEND_COOLDOWN', 60),
    ],

];
