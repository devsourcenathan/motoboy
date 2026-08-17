<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Resources;

use App\Modules\Rides\Models\Ride;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Ride */
final class RideResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray($request): array
    {
        return [
            'reference' => $this->reference,
            'status' => $this->status->value,
            'price' => ['amount' => $this->price_amount, 'currency' => $this->currency],
            'started_at' => $this->started_at?->toAtomString(),
            'completed_at' => $this->completed_at?->toAtomString(),
            /*
             * **Le telephone apparait ici**, et seulement ici : la course est
             * conclue, les deux parties doivent pouvoir se joindre. C'est tout
             * l'objet de l'appel de service.
             */
            'paid' => $this->isPaid(),
            'driver' => (fn () => [
                'first_name' => $this->loadMissing('driver.user')->driver?->user?->first_name,
                'last_name' => $this->driver?->user?->last_name,
                'phone' => $this->driver?->user?->phone,
                'vehicle_plate' => $this->driver?->vehicle_plate,
                'vehicle_model' => $this->driver?->vehicle_model,
            ])(),
        ];
    }
}
