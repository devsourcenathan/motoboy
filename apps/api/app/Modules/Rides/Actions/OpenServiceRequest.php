<?php

declare(strict_types=1);

namespace App\Modules\Rides\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Rides\Enums\ServiceRequestStatus;
use App\Modules\Rides\Models\ServiceRequest;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use App\Support\Reference;

/**
 * Ouvre un appel de service (E1).
 *
 * **Une demande ouverte à la fois.** Deux demandes simultanées du même passager
 * feraient répondre des chauffeurs à un besoin qui n'existe qu'une fois, et le
 * second à arriver aurait roulé pour rien. Le contrôle est ici plutôt qu'en base
 * parce qu'il porte sur un état — « ouverte » — et non sur une unicité de ligne :
 * le même passager en ouvrira d'autres demain.
 */
final class OpenServiceRequest
{
    /**
     * Durée de vie d'une demande sans réponse.
     *
     * Trente minutes : assez pour qu'un chauffeur consulte, réponde et se
     * déplace ; trop peu pour qu'un passager attende sans savoir. Passé ce
     * délai, mieux vaut lui dire que personne ne vient.
     */
    public const LIFETIME_MINUTES = 30;

    /** @param array<string, mixed> $attributes */
    public function handle(User $passenger, array $attributes): ServiceRequest
    {
        $pending = ServiceRequest::query()
            ->where('user_id', $passenger->id)
            ->whereIn('status', [
                ServiceRequestStatus::Open->value,
                ServiceRequestStatus::Offered->value,
                ServiceRequestStatus::Matched->value,
            ])
            ->where('expires_at', '>', now())
            ->exists();

        if ($pending) {
            throw ApiException::of(
                ErrorCode::ServiceRequestAlreadyOpen,
                'Une demande est déjà en cours. Annulez-la avant d\'en ouvrir une autre.',
            );
        }

        return ServiceRequest::query()->create([
            ...$attributes,
            'reference' => Reference::generate('SRV'),
            'user_id' => $passenger->id,
            'status' => ServiceRequestStatus::Open,
            'expires_at' => now()->addMinutes(self::LIFETIME_MINUTES),
        ]);
    }
}
