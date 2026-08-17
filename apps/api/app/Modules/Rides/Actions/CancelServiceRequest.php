<?php

declare(strict_types=1);

namespace App\Modules\Rides\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Rides\Enums\OfferStatus;
use App\Modules\Rides\Enums\RideStatus;
use App\Modules\Rides\Enums\ServiceRequestStatus;
use App\Modules\Rides\Models\ServiceRequest;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Support\Facades\DB;

/**
 * Le passager renonce (E1).
 *
 * **Sans pénalité pour l'instant**, faute d'arbitrage sur le coût d'une
 * annulation tardive — et il n'y a de toute façon rien à prélever avant que le
 * paiement n'existe. Ce qui est fait dès maintenant : tracer qui annule et
 * quand, parce que cette trace sera la matière du jour où la règle se décidera.
 */
final class CancelServiceRequest
{
    public function __construct(private readonly RefundRide $refunds) {}

    public function handle(ServiceRequest $request, User $actor, ?string $reason = null): ServiceRequest
    {
        if ($request->status === ServiceRequestStatus::Cancelled) {
            throw ApiException::of(ErrorCode::ServiceRequestClosed, 'Cette demande est déjà annulée.');
        }

        return DB::transaction(function () use ($request, $actor, $reason): ServiceRequest {
            /*
             * Les offres en attente tombent : un chauffeur qui patiente sur une
             * demande annulée attend pour rien, et c'est le genre d'attente qui
             * décourage de répondre la fois suivante.
             */
            $request->offers()
                ->where('status', OfferStatus::Pending->value)
                ->update(['status' => OfferStatus::Declined->value]);

            /*
             * Une course déjà conclue s'annule avec la demande. L'index partiel
             * libère alors le chauffeur, qui peut reprendre une course.
             */
            /*
             * Rembourser **avant** de changer l'etat : la regle se lit sur le
             * statut courant — gratuit tant que la course n'a pas demarre — et
             * l'annuler d'abord effacerait l'information dont depend la decision.
             */
            $existing = $request->ride;

            if ($existing !== null) {
                $this->refunds->onCancellation($existing);
            }

            $request->ride()->whereIn('status', [
                RideStatus::Matched->value,
                RideStatus::InProgress->value,
            ])->update([
                'status' => RideStatus::Cancelled->value,
                'cancelled_at' => now(),
                'cancelled_by' => $actor->id,
                'cancellation_reason' => $reason,
            ]);

            $request->update([
                'status' => ServiceRequestStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $actor->id,
                'cancellation_reason' => $reason,
            ]);

            return $request->refresh();
        });
    }
}
