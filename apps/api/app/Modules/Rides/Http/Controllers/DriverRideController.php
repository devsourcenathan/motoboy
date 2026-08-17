<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Rides\Actions\AdvanceRide;
use App\Modules\Rides\Actions\MakeOffer;
use App\Modules\Rides\Enums\ServiceRequestStatus;
use App\Modules\Rides\Http\Resources\RideOfferResource;
use App\Modules\Rides\Http\Resources\RideResource;
use App\Modules\Rides\Http\Resources\ServiceRequestResource;
use App\Modules\Rides\Models\DriverProfile;
use App\Modules\Rides\Models\Ride;
use App\Modules\Rides\Models\RideOffer;
use App\Modules\Rides\Models\ServiceRequest;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Le chauffeur, cote appel de service (E1).
 *
 * Aucune permission RBAC : comme le passager, ses droits decoulent de ce qu'il
 * possede — son dossier, ses offres, ses courses. Ce qui le limite reellement est
 * `canDrive()`, verifie a chaque offre.
 */
final class DriverRideController
{
    /**
     * Les demandes ouvertes de sa ville.
     *
     * Les plus anciennes d'abord : celui qui attend depuis le plus longtemps est
     * celui a qui il faut repondre. Trier a l'envers laisserait mourir la demande
     * deposee un jour de forte affluence.
     */
    public function requests(Request $request): JsonResponse
    {
        $driver = $this->driver($request);

        $requests = ServiceRequest::query()
            ->whereIn('status', [
                ServiceRequestStatus::Open->value,
                ServiceRequestStatus::Offered->value,
            ])
            // L'horloge autant que le statut : une demande perimee ne doit pas
            // apparaitre, meme si le balayage n'est pas encore passe.
            ->where('expires_at', '>', now())
            ->where('origin_city_id', $driver->city_id)
            ->orderBy('created_at')
            ->paginate(20);

        return response()->json([
            'data' => $requests->getCollection()
                ->map(fn (ServiceRequest $service) => (new ServiceRequestResource($service))->resolve())
                ->all(),
            'meta' => ['total' => $requests->total(), 'per_page' => $requests->perPage()],
        ]);
    }

    public function offer(Request $request, string $reference, MakeOffer $make): JsonResponse
    {
        $validated = $request->validate([
            // Borne haute large : c'est le marche qui tarife, pas la plateforme.
            // Une borne existe quand meme, parce qu'un zero de trop se saisit.
            'price_amount' => ['required', 'integer', 'min:100', 'max:10000000'],
            'eta_minutes' => ['required', 'integer', 'min:1', 'max:240'],
        ]);

        $service = ServiceRequest::query()->where('reference', $reference)->first();

        if ($service === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Demande introuvable.');
        }

        $offer = $make->handle(
            $service,
            $this->driver($request),
            (int) $validated['price_amount'],
            (int) $validated['eta_minutes'],
        );

        return response()->json((new RideOfferResource($offer))->resolve(), 201);
    }

    public function offers(Request $request): JsonResponse
    {
        $offers = RideOffer::query()
            ->where('driver_profile_id', $this->driver($request)->id)
            ->latest('id')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => $offers->map(fn (RideOffer $offer) => (new RideOfferResource($offer))->resolve())->all(),
        ]);
    }

    public function rides(Request $request): JsonResponse
    {
        $rides = Ride::query()
            ->where('driver_profile_id', $this->driver($request)->id)
            ->with('request')
            ->latest('id')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => $rides->map(fn (Ride $ride) => (new RideResource($ride))->resolve())->all(),
        ]);
    }

    public function start(Request $request, string $reference, AdvanceRide $advance): JsonResponse
    {
        return response()->json(
            (new RideResource($advance->start($this->ownRide($request, $reference))))->resolve(),
        );
    }

    public function complete(Request $request, string $reference, AdvanceRide $advance): JsonResponse
    {
        return response()->json(
            (new RideResource($advance->complete($this->ownRide($request, $reference))))->resolve(),
        );
    }

    private function ownRide(Request $request, string $reference): Ride
    {
        $ride = Ride::query()
            ->where('reference', $reference)
            ->where('driver_profile_id', $this->driver($request)->id)
            ->first();

        if ($ride === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Course introuvable.');
        }

        return $ride;
    }

    private function driver(Request $request): DriverProfile
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session absente.');
        }

        $driver = DriverProfile::query()->where('user_id', $user->id)->first();

        if ($driver === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Aucun dossier de chauffeur.');
        }

        return $driver;
    }
}
