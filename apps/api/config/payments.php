<?php

declare(strict_types=1);

use App\Modules\Payments\Gateways\FakePaymentGateway;
use App\Modules\Payments\Gateways\TranzakPaymentGateway;
use App\Modules\Payouts\Gateways\FakePayoutGateway;

return [

    /*
     * Agrégateur actif.
     *
     * Le prestataire n'est pas choisi : il doit l'être sur la grille de
     * capacités éliminatoires de B4 — remboursement et décaissement par API en
     * tête, car tous ne les proposent pas.
     *
     * Ce choix ne bloque pas le développement. Le pilote factice reproduit le
     * trait qui compte — rien n'est encaissé de façon synchrone — et permet de
     * construire tout le parcours. Ajouter un prestataire demandera une classe
     * implémentant `PaymentGateway` et une entrée ci-dessous.
     */
    'gateway' => env('PAYMENT_GATEWAY', 'fake'),

    'gateways' => [
        'fake' => FakePaymentGateway::class,
        'tranzak' => TranzakPaymentGateway::class,
    ],

    /*
     * Tranzak — https://docs.developer.tranzak.me/
     *
     * La cle porte un prefixe selon l'environnement (`SAND_` ou `PROD_`), et il
     * doit concorder avec l'URL. S'en remettre a l'un sans verifier l'autre
     * ferait un jour payer pour de vrai en croyant tester.
     */
    'tranzak' => [
        'base_url' => env('TRANZAK_BASE_URL', 'https://sandbox.dsapi.tranzak.me'),
        'app_id' => env('TRANZAK_APP_ID', ''),
        'app_key' => env('TRANZAK_APP_KEY', ''),
    ],

    /*
     * Décaisseur vers les agences.
     *
     * Port distinct : encaisser auprès d'un passager et verser à une agence sont
     * deux capacités séparées dans la grille de B4, et une agence de transfert
     * peut couvrir la seconde sans faire la première.
     */
    'payout_gateway' => env('PAYOUT_GATEWAY', 'fake'),

    'payout_gateways' => [
        'fake' => FakePayoutGateway::class,
    ],

    /*
     * Qui supporte les frais d'agrégateur, à défaut de réglage sur l'agence.
     *
     * `PLATFORM` par défaut afin que le prix affiché reste celui de l'agence :
     * un comparateur qui n'affiche pas le vrai prix perd sa raison d'être. Le
     * passager ne peut **jamais** les porter (B4).
     */
    'default_fee_bearer' => 'PLATFORM',

];
