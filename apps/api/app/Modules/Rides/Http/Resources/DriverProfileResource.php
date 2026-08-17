<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Resources;

use App\Modules\Rides\Models\DriverProfile;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DriverProfile
 */
final class DriverProfileResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray($request): array
    {
        return [
            'status' => $this->status->value,
            'can_drive' => $this->canDrive(),
            'license_number' => $this->license_number,
            'license_expires_at' => $this->license_expires_at->toDateString(),
            'vehicle_plate' => $this->vehicle_plate,
            'vehicle_type' => $this->vehicle_type->value,
            'vehicle_model' => $this->vehicle_model,
            'vehicle_seats' => $this->vehicle_seats,
            'city_id' => $this->city_id,
            /*
             * Le motif est renvoyé au chauffeur lui-même : c'est tout l'intérêt
             * de l'exiger. Un refus qu'il ne peut pas lire ne lui dit pas quoi
             * corriger.
             */
            'review_note' => $this->review_note,
            'reviewed_at' => $this->reviewed_at?->toAtomString(),
            // Les types déposés, pas les chemins : une URL de document se
            // délivre à la demande et pour dix minutes.
            'documents' => $this->documents->pluck('type')->map(fn ($type) => $type->value)->all(),
        ];
    }
}
