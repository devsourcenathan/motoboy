<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Requests;

use App\Modules\Fleet\Enums\VehicleType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Dépôt d'un dossier chauffeur.
 *
 * Le nombre de places est borné : au-delà, ce n'est plus un indépendant avec sa
 * voiture mais un transporteur, qui relève de l'espace agence.
 */
final class SubmitDriverApplicationRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'license_number' => ['required', 'string', 'max:64'],
            // Un permis déjà périmé au dépôt ne sert à rien : autant le dire
            // tout de suite plutôt qu'au refus.
            'license_expires_at' => ['required', 'date', 'after:today'],

            'vehicle_plate' => ['required', 'string', 'max:32'],
            'vehicle_type' => ['required', Rule::enum(VehicleType::class)],
            'vehicle_model' => ['nullable', 'string', 'max:120'],
            'vehicle_seats' => ['required', 'integer', 'min:1', 'max:20'],

            'city_id' => ['required', 'integer', 'exists:cities,id'],
        ];
    }
}
