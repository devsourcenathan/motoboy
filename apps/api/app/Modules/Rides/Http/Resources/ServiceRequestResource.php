<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Resources;

use App\Modules\Rides\Models\RideOffer;
use App\Modules\Rides\Models\ServiceRequest;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ServiceRequest */
final class ServiceRequestResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray($request): array
    {
        return [
            'reference' => $this->reference,
            'status' => $this->status->value,
            /*
             * Le **nom** de la ville, pas seulement son identifiant : l'ecran
             * affiche « Bafang », et le resoudre cote mobile serait une requete
             * de plus pour une donnee que le serveur a deja en main.
             *
             * `loadMissing` plutot qu'un chargement suppose : `shouldBeStrict()`
             * interdit le chargement paresseux, et une ressource ne doit pas
             * dependre de ce que l'appelant a pense a charger.
             */
            'origin' => [
                'city_id' => $this->origin_city_id,
                'city' => $this->loadMissing('originCity')->originCity?->name,
                'landmark' => $this->origin_landmark,
            ],
            'destination' => [
                'city_id' => $this->destination_city_id,
                'city' => $this->loadMissing('destinationCity')->destinationCity?->name,
                'landmark' => $this->destination_landmark,
            ],
            'passengers' => $this->passengers,
            'note' => $this->note,
            'expires_at' => $this->expires_at->toAtomString(),
            'created_at' => $this->created_at?->toAtomString(),
            /*
             * Les offres sont comparables ici et nulle part ailleurs : c'est cet
             * ecran qui porte la promesse du produit, appliquee a un autre
             * inventaire que les departs programmes.
             */
            'offers' => $this->whenLoaded(
                'offers',
                fn () => $this->offers
                    ->map(fn (RideOffer $offer) => (new RideOfferResource($offer))->resolve())
                    ->all(),
            ),
            'ride' => $this->whenLoaded(
                'ride',
                fn () => $this->ride === null ? null : (new RideResource($this->ride))->resolve(),
            ),
        ];
    }
}
