<?php

declare(strict_types=1);

use App\Modules\Administration\Http\Controllers\AdminAgencyController;
use App\Modules\Administration\Http\Controllers\AdminDashboardController;
use App\Modules\Administration\Http\Controllers\AdminPayoutAccountController;
use App\Modules\Administration\Http\Controllers\AdminReferenceController;
use App\Modules\Administration\Http\Controllers\ClientConfigController;
use App\Modules\Administration\Http\Controllers\DocumentController;
use App\Modules\Administration\Http\Controllers\PlatformSettingController;
use App\Modules\Agencies\Http\Controllers\AgencyAccountController;
use App\Modules\Agencies\Http\Controllers\AgencyStaffController;
use App\Modules\Agencies\Http\Controllers\CancellationController;
use App\Modules\Agencies\Http\Controllers\CounterSaleController;
use App\Modules\Agencies\Http\Controllers\FleetController;
use App\Modules\Agencies\Http\Controllers\RoutingController;
use App\Modules\Agencies\Http\Controllers\StationController;
use App\Modules\Bookings\Http\Controllers\BookingController;
use App\Modules\Bookings\Http\Controllers\IdDocumentController;
use App\Modules\Fleet\Http\Controllers\OwnerController;
use App\Modules\Identity\Http\Controllers\AuthController;
use App\Modules\Payments\Http\Controllers\PaymentController;
use App\Modules\Payments\Http\Controllers\WebhookController;
use App\Modules\Payouts\Http\Controllers\AdminPayoutController;
use App\Modules\Payouts\Http\Controllers\AgencyPayoutController;
use App\Modules\Payouts\Http\Controllers\PayoutWebhookController;
use App\Modules\Places\Http\Controllers\PlaceController;
use App\Modules\Rides\Http\Controllers\AdminDriverController;
use App\Modules\Rides\Http\Controllers\AdminServiceRequestController;
use App\Modules\Rides\Http\Controllers\DriverController;
use App\Modules\Rides\Http\Controllers\DriverEarningsController;
use App\Modules\Rides\Http\Controllers\DriverRideController;
use App\Modules\Rides\Http\Controllers\ServiceRequestController;
use App\Modules\Tickets\Http\Controllers\BoardingController;
use App\Modules\Tickets\Http\Controllers\TicketController;
use App\Modules\Trips\Http\Controllers\SearchController;
use App\Modules\Trips\Http\Controllers\TripController;
use Illuminate\Support\Facades\Route;

/*
 * API versionnée dès le départ (§29 du brief).
 *
 * Les préfixes portent la frontière d'autorisation, visible dans la route comme
 * dans le client généré : `/v1/…` public ou passager, `/v1/agency/…`,
 * `/v1/owner/…`, `/v1/admin/…`.
 *
 * Le contrat fait foi : `docs/openapi.yaml` est normatif, et l'implémentation
 * est vérifiée contre lui — pas l'inverse.
 */

Route::prefix('v1')->group(function (): void {

    // Recherche et consultation : publiques, sans authentification. C'est le
    // premier écran du passager, et il doit fonctionner avant tout compte.
    /*
     * Ce que le client doit savoir avant d'afficher un formulaire — la forme de
     * piece d'identite attendue, aujourd'hui. Public : l'ecran de reservation en
     * a besoin avant tout compte.
     */
    Route::get('config', ClientConfigController::class);

    /*
     * Consultation d'une pièce déposée.
     *
     * **Hors du groupe authentifié, et c'est l'intention** : l'autorisation
     * tient à la signature du lien, que `signed` vérifie. Un document s'ouvre
     * dans un onglet, et un onglet ne porte pas le jeton gardé en mémoire par
     * le client. Le lien vaut dix minutes ; passé ce délai, il ne vaut plus
     * rien.
     */
    Route::get('documents/{kind}/{document}', DocumentController::class)
        ->middleware('signed')
        ->whereIn('kind', ['agency', 'driver'])
        ->whereNumber('document')
        ->name('documents.show');

    Route::get('places/autocomplete', [PlaceController::class, 'autocomplete']);
    Route::get('search', SearchController::class);
    Route::get('trips/{reference}', [TripController::class, 'show']);
    Route::get('trips/{reference}/seats', [TripController::class, 'seats']);

    /*
     * Authentification.
     *
     * La limitation de débit protège autant le budget que le compte : chaque
     * demande de code envoie un SMS payant, et l'OTP est le seul canal sans
     * alternative (I8). Une borne par adresse complète celle par numéro, portée
     * par l'Action — sans quoi un attaquant balaierait les numéros un par un.
     */
    Route::middleware('throttle:10,1')->group(function (): void {
        Route::post('auth/register', [AuthController::class, 'register']);
        Route::post('auth/login', [AuthController::class, 'login']);
        Route::post('auth/otp/resend', [AuthController::class, 'resend']);
        Route::post('auth/otp/verify', [AuthController::class, 'verify']);

        /*
         * Inscription d'une agence (§23).
         *
         * Même limitation de débit que l'inscription passager : elle envoie un
         * SMS payant, et c'est le seul canal de vérification.
         */
        Route::post('agencies/register', [AgencyAccountController::class, 'register']);
    });

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('me', [AuthController::class, 'me']);
        Route::patch('me', [AuthController::class, 'updateMe']);
        Route::post('auth/logout', [AuthController::class, 'logout']);

        /*
         * Son propre dossier de chauffeur (E2).
         *
         * Aucune permission requise : le dossier est atteint par la session, pas
         * par un identifiant d'URL, donc un chauffeur ne peut lire que le sien.
         * C'est `canDrive()` qui décidera du droit de rouler, pas ces routes.
         */
        Route::get('driver', [DriverController::class, 'show']);
        Route::post('driver', [DriverController::class, 'submit']);
        Route::post('driver/documents', [DriverController::class, 'uploadDocument']);

        /*
         * Appel de service, cote passager (E1).
         *
         * Une demande se retrouve par sa reference, mais n'est rendue qu'a son
         * auteur : un identifiant d'URL ne donne acces a rien.
         */
        Route::post('service-requests', [ServiceRequestController::class, 'store']);
        Route::get('service-requests', [ServiceRequestController::class, 'index']);
        Route::get('service-requests/{reference}', [ServiceRequestController::class, 'show']);
        Route::post('service-requests/{reference}/cancel', [ServiceRequestController::class, 'cancel']);

        /*
         * L'argent d'une course (E4 bis). Le paiement se fait a l'acceptation ;
         * l'absence du chauffeur est signalee par le passager, seul temoin
         * possible faute de suivi de position.
         */
        Route::post('rides/{reference}/payments', [ServiceRequestController::class, 'pay']);
        Route::post('rides/{reference}/no-show', [ServiceRequestController::class, 'reportNoShow']);
        Route::post('offers/{offer}/accept', [ServiceRequestController::class, 'accept']);

        /*
         * Appel de service, cote chauffeur (E1). Aucune permission RBAC : ce qui
         * limite reellement est `canDrive()`, verifie a chaque offre.
         */
        Route::get('driver/requests', [DriverRideController::class, 'requests']);
        Route::post('service-requests/{reference}/offers', [DriverRideController::class, 'offer']);
        Route::get('driver/offers', [DriverRideController::class, 'offers']);
        Route::get('driver/rides', [DriverRideController::class, 'rides']);
        Route::post('driver/rides/{reference}/start', [DriverRideController::class, 'start']);
        Route::post('driver/rides/{reference}/complete', [DriverRideController::class, 'complete']);

        /*
         * Son argent (C8, C9). En lecture pour le solde et l'historique, en
         * ecriture pour la seule chose qu'il declare : ou verser.
         */
        Route::get('driver/earnings', [DriverEarningsController::class, 'earnings']);
        Route::get('driver/payout-accounts', [DriverEarningsController::class, 'payoutAccounts']);
        Route::post('driver/payout-accounts', [DriverEarningsController::class, 'submitPayoutAccount']);

        // Réservation. La prise de places est l'opération atomique du produit :
        // elle tient les places avant même la saisie du paiement (B2).
        /*
         * La piece se depose **avant** la reservation et renvoie un chemin :
         * televerser pendant que la place est tenue ferait perdre celle-ci sur un
         * echec de reseau.
         */
        Route::post('id-documents', [IdDocumentController::class, 'store']);

        Route::post('bookings', [BookingController::class, 'store']);
        Route::get('bookings', [BookingController::class, 'index']);
        Route::get('bookings/{reference}', [BookingController::class, 'show']);

        /*
         * Annulation et remboursement (B5).
         *
         * Le devis précède l'annulation : le passager doit voir ce qu'il
         * récupérera avant de confirmer, sinon une règle acceptée devient un
         * litige.
         */
        Route::get('bookings/{reference}/cancellation-quote', [BookingController::class, 'cancellationQuote']);
        Route::post('bookings/{reference}/cancel', [BookingController::class, 'cancel']);

        Route::post('bookings/{reference}/payments', [PaymentController::class, 'store']);
        Route::get('payments/{reference}', [PaymentController::class, 'show']);

        // Billets. Le client les met en cache : ils doivent rester consultables
        // sans réseau, en gare (I5).
        Route::get('tickets', [TicketController::class, 'index']);
        Route::get('tickets/{reference}', [TicketController::class, 'show']);

        /*
         * Embarquement — rôle `AGENT`.
         *
         * L'autorisation est vérifiée **par départ**, pas par le groupe de
         * routes : la permission est portée pour une agence donnée, et le
         * départ est ce qui désigne laquelle (B3).
         */
        Route::prefix('agency')->group(function (): void {
            Route::get('trips', [BoardingController::class, 'trips']);
            Route::get('trips/{reference}/boarding-list', [BoardingController::class, 'list']);
            Route::post('trips/{reference}/validations', [BoardingController::class, 'sync']);
            Route::post('tickets/lookup', [BoardingController::class, 'lookup']);

            /*
             * Alimentation de l'inventaire.
             *
             * Sans ces écrans, la recherche ne renvoie rien et le produit
             * n'existe pas : c'est le chantier qui devait avancer en parallèle
             * du parcours passager, pas après.
             */
            Route::get('stations', [StationController::class, 'index']);
            Route::post('stations', [StationController::class, 'store']);
            Route::patch('stations/{id}', [StationController::class, 'update']);
            Route::post('city-requests', [StationController::class, 'requestCity']);

            Route::get('vehicles', [FleetController::class, 'vehicles']);
            Route::post('vehicles', [FleetController::class, 'storeVehicle']);
            Route::patch('vehicles/{id}', [FleetController::class, 'updateVehicle']);
            Route::get('vehicles/{id}/seats', [FleetController::class, 'seats']);

            Route::get('drivers', [FleetController::class, 'drivers']);
            Route::post('drivers', [FleetController::class, 'storeDriver']);
            Route::patch('drivers/{id}', [FleetController::class, 'updateDriver']);

            Route::get('routes', [RoutingController::class, 'routes']);
            Route::post('routes', [RoutingController::class, 'storeRoute']);
            Route::post('routes/{routeId}/schedules', [RoutingController::class, 'storeSchedule']);
            /*
             * **Arrêter un horaire, faute de quoi il vend pour toujours.**
             * `is_active` et `valid_until` existaient en base et rien ne
             * pouvait les écrire : une ligne qui cesse d'être desservie
             * continuait de produire des départs.
             */
            Route::patch('routes/{routeId}/schedules/{id}', [RoutingController::class, 'updateSchedule']);
            Route::post('trips/generate', [RoutingController::class, 'generate']);

            /*
             * Vente au comptoir (I2).
             *
             * C'est elle qui porte l'intégrité de toute la disponibilité
             * affichée : une agence qui vend vingt places sans les saisir fait
             * déplacer des passagers pour rien. Un seul appel, donc — la saisie
             * doit être plus rapide que le cahier.
             */
            Route::post('counter-sales', [CounterSaleController::class, 'store']);
            Route::get('trips/{reference}/seats', [CounterSaleController::class, 'seats']);

            /*
             * Annulations à l'initiative de l'agence (B5).
             *
             * L'annulation d'une réservation par l'agence n'est pas du confort :
             * un passager de vente au comptoir n'a pas de compte et ne peut rien
             * annuler lui-même.
             */
            Route::post('trips/{reference}/cancel', [CancellationController::class, 'trip']);
            Route::post('bookings/{reference}/cancel', [CancellationController::class, 'booking']);

            /*
             * Ce que l'agence voit de son argent (B4).
             *
             * Le compte courant est en lecture seule : les écritures sont
             * immuables, et une correction se fait par écriture inverse depuis
             * l'administration.
             */
            Route::get('payouts', [AgencyPayoutController::class, 'index']);
            Route::get('payouts/{reference}', [AgencyPayoutController::class, 'show']);
            Route::get('payouts/{reference}/statement', [AgencyPayoutController::class, 'statement']);
            Route::get('ledger', [AgencyPayoutController::class, 'ledger']);

            /*
             * Dossier de l'agence (§23, B4).
             *
             * Les coordonnées de reversement se **déclarent** ici mais ne
             * s'appliquent pas : elles naissent non vérifiées et n'encaissent
             * rien tant que l'administration ne les a pas vérifiées.
             */
            /*
             * Son identité et son statut. Lisible **avant** l'admission : c'est
             * l'agence en attente qui en a le plus besoin.
             */
            Route::get('/', [AgencyAccountController::class, 'show']);

            Route::get('payout-accounts', [AgencyAccountController::class, 'payoutAccounts']);
            Route::post('payout-accounts', [AgencyAccountController::class, 'submitPayoutAccount']);
            /*
             * Personnel de l'agence. Deux profils attribuables — `AGENT` pour
             * l'embarquement, `COUNTER` pour la vente — et jamais `AGENCY` : on ne
             * delegue pas ici le droit de deleguer.
             */
            Route::get('staff', [AgencyStaffController::class, 'index']);
            Route::post('staff', [AgencyStaffController::class, 'store']);
            Route::delete('staff/{user}', [AgencyStaffController::class, 'destroy']);

            Route::get('documents', [AgencyAccountController::class, 'documents']);
            Route::post('documents', [AgencyAccountController::class, 'uploadDocument']);
        });

        /*
         * Administration — ouverte au strict nécessaire.
         *
         * Sans ces trois opérations le circuit financier ne se referme jamais :
         * le calcul est automatique, mais rien ne le valide ni ne l'envoie. Le
         * reste de l'espace d'administration reste à construire.
         */
        /*
         * Espace proprietaire (I3) — **consultation seule**. Sa remuneration se
         * regle directement avec l'agence ; la plateforme ne porte aucun flux
         * vers lui, et lui ouvrir un endpoint d'ecriture laisserait croire le
         * contraire.
         */
        Route::get('owner/vehicles', [OwnerController::class, 'vehicles']);
        Route::get('owner/vehicles/{vehicle}/trips', [OwnerController::class, 'trips']);

        Route::prefix('admin')->group(function (): void {
            Route::get('payouts', [AdminPayoutController::class, 'index']);
            Route::post('payouts/build', [AdminPayoutController::class, 'build']);
            Route::post('payouts/{reference}/approve', [AdminPayoutController::class, 'approve']);
            Route::post('payouts/{reference}/send', [AdminPayoutController::class, 'send']);

            Route::get('dashboard', AdminDashboardController::class);

            /*
             * Modération des dossiers chauffeur (A1-A3). Sans agence pour
             * répondre d'un incident, cette file est la seule barrière entre la
             * plateforme et un chauffeur dont personne n'a vu le permis.
             */
            /*
             * Parametres commerciaux (E4 bis). Reserve au super-administrateur,
             * comme les bornes de B4 : configurer la plateforme n'est pas une
             * operation quotidienne (I4).
             */
            Route::get('settings', [PlatformSettingController::class, 'show']);
            Route::patch('settings/ride-commission', [PlatformSettingController::class, 'updateRideCommission']);
            Route::patch('settings/id-documents', [PlatformSettingController::class, 'updateIdDocumentPolicy']);

            Route::get('drivers', [AdminDriverController::class, 'index']);
            Route::post('drivers/{driver}/approve', [AdminDriverController::class, 'approve']);
            Route::post('drivers/{driver}/reject', [AdminDriverController::class, 'reject']);
            Route::post('drivers/{driver}/suspend', [AdminDriverController::class, 'suspend']);

            /*
             * Destinations de virement a verifier (B4, C9). Sans ce geste, un
             * compte declare reste inactif et la passe de reversement s'arrete
             * sur `NO_VERIFIED_ACCOUNT` — sans que rien ne le signale.
             */
            Route::get('payout-accounts', [AdminPayoutAccountController::class, 'index']);

            // « Ou en est ma course ? » (A4). Lecture seule.
            Route::get('service-requests/{reference}', [AdminServiceRequestController::class, 'show']);

            /*
             * Validation des agences (§23).
             *
             * Valider une agence et vérifier ses coordonnées de reversement sont
             * **deux gestes distincts** : l'un dit « cette entreprise existe »,
             * l'autre « cet argent peut partir là ».
             */
            Route::get('agencies', [AdminAgencyController::class, 'index']);
            Route::get('agencies/{reference}', [AdminAgencyController::class, 'show']);
            Route::post('agencies/{reference}/approve', [AdminAgencyController::class, 'approve']);
            Route::post('agencies/{reference}/reject', [AdminAgencyController::class, 'reject']);
            Route::patch('agencies/{reference}/commercial-terms', [AdminAgencyController::class, 'updateTerms']);
            Route::post('agencies/{reference}/ledger-adjustments', [AdminAgencyController::class, 'adjustLedger']);
            Route::post('payout-accounts/{id}/verify', [AdminAgencyController::class, 'verifyAccount']);

            // Référentiel géographique (B1) et journal d'audit (§28).
            Route::get('city-requests', [AdminReferenceController::class, 'cityRequests']);
            Route::post('city-requests/{id}/resolve', [AdminReferenceController::class, 'resolveCityRequest']);
            Route::get('stations', [AdminReferenceController::class, 'stations']);
            Route::post('stations/{id}/moderate', [AdminReferenceController::class, 'moderateStation']);
            Route::get('audit-logs', [AdminReferenceController::class, 'auditLogs']);
        });
    });

    /*
     * Webhook de l'agrégateur.
     *
     * Hors `auth:sanctum` — l'appelant est un prestataire, pas un passager.
     * L'authentification repose sur la signature de la charge utile, vérifiée
     * par l'adaptateur, et chaque appel est journalisé avant tout traitement.
     */
    Route::post('webhooks/payments/{provider}', WebhookController::class);

    /*
     * Décaissements — endpoint distinct parce que le port l'est : rien n'oblige
     * le décaisseur à être l'agrégateur d'encaissement.
     *
     * C'est cette notification qui fait sortir un reversement de `PROCESSING` ;
     * sans elle, un reversement en vol bloquerait à jamais les suivants.
     */
    Route::post('webhooks/payouts/{provider}', PayoutWebhookController::class);

});
