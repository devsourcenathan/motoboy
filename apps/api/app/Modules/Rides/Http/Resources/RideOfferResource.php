<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Resources;

use App\Modules\Rides\Models\RideOffer;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin RideOffer */
final class RideOfferResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'price' => ['amount' => $this->price_amount, 'currency' => $this->currency],
            'eta_minutes' => $this->eta_minutes,
            'expires_at' => $this->expires_at->toAtomString(),
            /*
             * Le nom et le vehicule, jamais le telephone : les coordonnees ne
             * s'echangent qu'une fois l'offre retenue. Les livrer avec chaque
             * offre reviendrait a publier les numeros de tous les chauffeurs qui
             * repondent.
             */
            /*
             * Toujours present, jamais conditionnel : une offre sans chauffeur
             * n'existe pas, et l'exposer comme facultatif obligerait chaque
             * ecran a gerer un cas impossible.
             */
            'driver' => (fn () => [
                'first_name' => $this->loadMissing('driver.user')->driver?->user?->first_name,
                'vehicle_plate' => $this->driver?->vehicle_plate,
                'vehicle_model' => $this->driver?->vehicle_model,
                'vehicle_seats' => $this->driver?->vehicle_seats,
            ])(),
        ];
    }
}
