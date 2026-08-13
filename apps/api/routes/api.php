<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Controllers\AuthController;
use App\Modules\Places\Http\Controllers\PlaceController;
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
    });

});
