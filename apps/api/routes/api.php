<?php

declare(strict_types=1);

use App\Modules\Agencies\Http\Controllers\CancellationController;
use App\Modules\Agencies\Http\Controllers\CounterSaleController;
use App\Modules\Agencies\Http\Controllers\FleetController;
use App\Modules\Agencies\Http\Controllers\RoutingController;
use App\Modules\Agencies\Http\Controllers\StationController;
use App\Modules\Bookings\Http\Controllers\BookingController;
use App\Modules\Identity\Http\Controllers\AuthController;
use App\Modules\Payments\Http\Controllers\PaymentController;
use App\Modules\Payments\Http\Controllers\WebhookController;
use App\Modules\Places\Http\Controllers\PlaceController;
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
    });

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);

        // Réservation. La prise de places est l'opération atomique du produit :
        // elle tient les places avant même la saisie du paiement (B2).
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
            Route::get('vehicles/{id}/seats', [FleetController::class, 'seats']);

            Route::get('drivers', [FleetController::class, 'drivers']);
            Route::post('drivers', [FleetController::class, 'storeDriver']);

            Route::get('routes', [RoutingController::class, 'routes']);
            Route::post('routes', [RoutingController::class, 'storeRoute']);
            Route::post('routes/{routeId}/schedules', [RoutingController::class, 'storeSchedule']);
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

});
