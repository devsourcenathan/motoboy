<?php

declare(strict_types=1);

namespace App\Modules\Rides\Actions;

use App\Modules\Rides\Enums\RideStatus;
use App\Modules\Rides\Models\Ride;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;

/**
 * Le chauffeur fait avancer sa course (E1).
 *
 * Deux transitions, et une seule direction : `MATCHED` → `IN_PROGRESS` →
 * `COMPLETED`. Pas de retour en arrière — une course reprise après avoir été
 * déclarée terminée est un incident, pas un geste d'interface, et se règle par
 * le support.
 *
 * Aucun état « en route vers le passager » : sans suivi de position (E3), la
 * plateforme ne pourrait pas le constater, et un état invérifiable se
 * désynchronise du terrain.
 */
final class AdvanceRide
{
    public function start(Ride $ride): Ride
    {
        if ($ride->status !== RideStatus::Matched) {
            throw ApiException::of(ErrorCode::OfferNotAcceptable, 'Cette course ne peut pas démarrer.');
        }

        $ride->update(['status' => RideStatus::InProgress, 'started_at' => now()]);

        return $ride->refresh();
    }

    public function complete(Ride $ride): Ride
    {
        if ($ride->status !== RideStatus::InProgress) {
            throw ApiException::of(ErrorCode::OfferNotAcceptable, 'Cette course n\'est pas en cours.');
        }

        /*
         * La course quitte ici l'état actif : l'index partiel libère le
         * chauffeur, qui peut en accepter une autre. C'est aussi le point où le
         * paiement s'accrochera (étape 4).
         */
        $ride->update(['status' => RideStatus::Completed, 'completed_at' => now()]);

        return $ride->refresh();
    }
}
