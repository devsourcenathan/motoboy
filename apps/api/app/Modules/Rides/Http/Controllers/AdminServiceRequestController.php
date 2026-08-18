<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Rides\Http\Resources\ServiceRequestResource;
use App\Modules\Rides\Models\Ride;
use App\Modules\Rides\Models\ServiceRequest;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * « Ou en est ma course ? » (A4).
 *
 * Le support recoit un appel et une reference — parfois celle de la demande,
 * parfois celle de la course, l'appelant ne faisant pas la difference. **Les deux
 * entrent ici** : imposer la bonne reviendrait a demander a quelqu'un d'inquiet
 * de comprendre un decoupage interne avant d'etre aide.
 *
 * En **lecture seule**. Le support constate, il ne decide pas : annuler ou
 * rembourser depuis cet ecran contournerait les gardes des Actions — celles qui
 * refusent de demarrer une course impayee ou de rembourser deux fois.
 */
final class AdminServiceRequestController
{
    public function show(Request $request, string $reference): JsonResponse
    {
        $this->supporter($request);

        $service = $this->locate($reference);

        if ($service === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Aucune demande ni course sous cette référence.');
        }

        return response()->json(
            (new ServiceRequestResource($service->load([
                'offers.driver.user', 'ride.driver.user', 'originCity', 'destinationCity',
            ])))->resolve(),
        );
    }

    /**
     * Retrouve la demande, quelle que soit la reference donnee.
     *
     * La course d'abord ou la demande d'abord ne change rien au resultat : les
     * prefixes ne se chevauchent pas. On essaie donc les deux plutot que de se
     * fier a la forme de la chaine, qu'un changement de generateur invaliderait
     * en silence.
     */
    private function locate(string $reference): ?ServiceRequest
    {
        $service = ServiceRequest::query()->where('reference', $reference)->first();

        if ($service !== null) {
            return $service;
        }

        $ride = Ride::query()->where('reference', $reference)->first();

        return $ride === null
            ? null
            : ServiceRequest::query()->whereKey($ride->service_request_id)->first();
    }

    private function supporter(Request $request): User
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session absente.');
        }

        if (!$user->hasGlobalPermission('independent_drivers.moderate')) {
            throw ApiException::of(ErrorCode::Forbidden, 'Permission insuffisante.');
        }

        return $user;
    }
}
