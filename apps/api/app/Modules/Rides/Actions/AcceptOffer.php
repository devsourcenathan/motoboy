<?php

declare(strict_types=1);

namespace App\Modules\Rides\Actions;

use App\Modules\Rides\Enums\OfferStatus;
use App\Modules\Rides\Enums\ServiceRequestStatus;
use App\Modules\Rides\Models\Ride;
use App\Modules\Rides\Models\RideOffer;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use App\Support\Reference;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Le passager retient une offre (E1).
 *
 * **C'est l'opération concurrente du module**, l'équivalent de la prise de
 * places (B2). Deux garde-fous sont portés par la base et non par ce code : une
 * seule offre acceptée par demande, une seule course active par chauffeur. Les
 * vérifier en PHP laisserait passer deux requêtes arrivées à la même
 * milliseconde — et promettrait le même véhicule à deux passagers.
 */
final class AcceptOffer
{
    public function handle(RideOffer $offer): Ride
    {
        $request = $offer->request;

        if ($request === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Demande introuvable.');
        }

        if (!$offer->isAcceptable()) {
            throw ApiException::of(ErrorCode::OfferNotAcceptable, 'Cette offre n\'est plus valable.');
        }

        if (!$request->isOpenForOffers()) {
            throw ApiException::of(ErrorCode::ServiceRequestClosed, 'Cette demande n\'est plus en attente.');
        }

        try {
            return DB::transaction(function () use ($offer, $request): Ride {
                $offer->update(['status' => OfferStatus::Accepted]);

                /*
                 * Les autres offres tombent, et le chauffeur doit le savoir :
                 * les laisser en attente le ferait patienter sur une demande
                 * déjà pourvue.
                 */
                RideOffer::query()
                    ->where('service_request_id', $request->id)
                    ->whereKeyNot($offer->id)
                    ->where('status', OfferStatus::Pending->value)
                    ->update(['status' => OfferStatus::Declined->value]);

                $request->update(['status' => ServiceRequestStatus::Matched]);

                return Ride::query()->create([
                    'reference' => Reference::generate('RID'),
                    'service_request_id' => $request->id,
                    'ride_offer_id' => $offer->id,
                    'driver_profile_id' => $offer->driver_profile_id,
                    // Recopié : l'offre peut être nettoyée, la course doit
                    // rester lisible telle qu'elle a été conclue.
                    'price_amount' => $offer->price_amount,
                    'currency' => $offer->currency,
                ]);
            });
        } catch (QueryException $e) {
            /*
             * **Seule une violation d'unicite est convertie.** Attraper toute
             * QueryException ferait passer un bug de schema pour un conflit de
             * concurrence : le passager lirait « ce chauffeur vient d'etre
             * retenu » alors que rien n'a ete retenu, et la cause resterait
             * invisible. 23505 est le code PostgreSQL de la violation d'unicite.
             */
            if ($e->getCode() !== '23505') {
                throw $e;
            }

            /*
             * L'un des deux index partiels a parlé. Le distinguer d'une panne
             * serait fragile ; ce qui compte est de rendre au passager un refus
             * qu'il comprend plutôt qu'une erreur serveur.
             */
            throw ApiException::of(
                ErrorCode::OfferAlreadyTaken,
                'Ce chauffeur vient d\'être retenu ailleurs. Choisissez une autre offre.',
            );
        }
    }
}
