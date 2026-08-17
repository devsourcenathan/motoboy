<?php

declare(strict_types=1);

namespace App\Modules\Rides\Actions;

use App\Modules\Rides\Enums\OfferStatus;
use App\Modules\Rides\Enums\ServiceRequestStatus;
use App\Modules\Rides\Models\RideOffer;
use App\Modules\Rides\Models\ServiceRequest;

/**
 * Ferme ce que le temps a périmé (E1).
 *
 * L'expiration est déjà **vraie** sans écriture : `isOpenForOffers()` regarde
 * l'horloge, donc une demande périmée n'accepte plus rien avant même le passage
 * de cette tâche. Ce balayage existe pour rendre l'état **lisible** — un
 * passager doit voir « personne n'est venu » plutôt qu'une demande éternellement
 * « en attente ».
 */
final class ExpireServiceRequests
{
    /** @return array{requests: int, offers: int} */
    public function handle(): array
    {
        $requests = ServiceRequest::query()
            ->whereIn('status', [
                ServiceRequestStatus::Open->value,
                ServiceRequestStatus::Offered->value,
            ])
            ->where('expires_at', '<=', now())
            ->update(['status' => ServiceRequestStatus::Expired->value]);

        // Les offres périmées aussi : un chauffeur doit savoir que sa
        // proposition ne court plus, sinon il la croit encore en jeu.
        $offers = RideOffer::query()
            ->where('status', OfferStatus::Pending->value)
            ->where('expires_at', '<=', now())
            ->update(['status' => OfferStatus::Expired->value]);

        return ['requests' => $requests, 'offers' => $offers];
    }
}
