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
    public function __construct(private readonly RecordRideSettlement $settlement) {}

    public function start(Ride $ride): Ride
    {
        if ($ride->status !== RideStatus::Matched) {
            throw ApiException::of(ErrorCode::OfferNotAcceptable, 'Cette course ne peut pas démarrer.');
        }

        /*
         * **Rien ne roule avant d'être payé** (E4 bis, décision 1 : tout se règle
         * à l'acceptation).
         *
         * Sans ce contrôle, une course entière pouvait se dérouler sans qu'un
         * franc ait bougé — et le règlement de fin de course créditait alors le
         * chauffeur d'un argent que la plateforme n'avait jamais encaissé. C'est
         * aussi ce qui donne son sens au remboursement pour absence : il n'y a de
         * course à honorer que parce qu'elle est payée.
         *
         * L'écran du chauffeur grise déjà le bouton, mais une règle d'argent
         * tenue par une interface n'est pas tenue.
         */
        if (!$ride->isPaid()) {
            throw ApiException::of(
                ErrorCode::RideNotPaid,
                'Le passager n\'a pas encore payé cette course.',
            );
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
         * chauffeur, qui peut en accepter une autre.
         */
        $ride->update(['status' => RideStatus::Completed, 'completed_at' => now()]);

        /*
         * Le reglement suit immediatement la fin de course, et il est rejouable :
         * terminer deux fois ne crediterait pas deux fois. Le differer aurait
         * laisse une fenetre ou le chauffeur a roule sans que rien ne lui soit du.
         */
        $this->settlement->handle($ride->refresh());

        return $ride->refresh();
    }
}
