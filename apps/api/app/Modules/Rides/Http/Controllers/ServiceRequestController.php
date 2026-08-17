<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Rides\Actions\AcceptOffer;
use App\Modules\Rides\Actions\CancelServiceRequest;
use App\Modules\Rides\Actions\OpenServiceRequest;
use App\Modules\Rides\Http\Resources\RideResource;
use App\Modules\Rides\Http\Resources\ServiceRequestResource;
use App\Modules\Rides\Models\RideOffer;
use App\Modules\Rides\Models\ServiceRequest;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Le passager, cote appel de service (E1).
 *
 * Tout est porte par la session : une demande se retrouve par sa reference, mais
 * elle n'est rendue qu'a son auteur. Un identifiant d'URL ne donne acces a rien.
 */
final class ServiceRequestController
{
    public function store(Request $request, OpenServiceRequest $open): JsonResponse
    {
        $validated = $request->validate([
            'origin_city_id' => ['required', 'integer', 'exists:cities,id'],
            // Le point de repere est obligatoire : « Bafang » situe la ville, pas
            // le passager. Sans lui, le chauffeur ne sait pas ou se rendre (E3).
            'origin_landmark' => ['required', 'string', 'min:3', 'max:160'],
            'destination_city_id' => ['required', 'integer', 'exists:cities,id'],
            'destination_landmark' => ['nullable', 'string', 'max:160'],
            'passengers' => ['required', 'integer', 'min:1', 'max:20'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $service = $open->handle($this->passenger($request), $validated);

        return response()->json(
            (new ServiceRequestResource($service))->resolve(),
            201,
        );
    }

    public function index(Request $request): JsonResponse
    {
        $requests = ServiceRequest::query()
            ->where('user_id', $this->passenger($request)->id)
            ->with(['offers.driver.user', 'ride.driver.user'])
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'data' => $requests->getCollection()
                ->map(fn (ServiceRequest $service) => (new ServiceRequestResource($service))->resolve())
                ->all(),
            'meta' => ['total' => $requests->total(), 'per_page' => $requests->perPage()],
        ]);
    }

    public function show(Request $request, string $reference): JsonResponse
    {
        $service = $this->own($request, $reference);

        return response()->json(
            (new ServiceRequestResource($service->load(['offers.driver.user', 'ride.driver.user'])))->resolve(),
        );
    }

    public function cancel(Request $request, string $reference, CancelServiceRequest $cancel): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $service = $cancel->handle(
            $this->own($request, $reference),
            $this->passenger($request),
            $validated['reason'] ?? null,
        );

        return response()->json((new ServiceRequestResource($service))->resolve());
    }

    /**
     * Retenir une offre.
     *
     * L'offre est atteinte par son identifiant, mais la demande qui la porte doit
     * appartenir a l'appelant : sans ce controle, n'importe qui pourrait retenir
     * un chauffeur sur la demande d'un autre.
     */
    public function accept(Request $request, RideOffer $offer, AcceptOffer $accept): JsonResponse
    {
        $service = $offer->request;

        if ($service === null || $service->user_id !== $this->passenger($request)->id) {
            throw ApiException::of(ErrorCode::NotFound, 'Offre introuvable.');
        }

        $ride = $accept->handle($offer);

        return response()->json(
            (new RideResource($ride->load('driver.user')))->resolve(),
            201,
        );
    }

    private function own(Request $request, string $reference): ServiceRequest
    {
        $service = ServiceRequest::query()
            ->where('reference', $reference)
            ->where('user_id', $this->passenger($request)->id)
            ->first();

        if ($service === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Demande introuvable.');
        }

        return $service;
    }

    private function passenger(Request $request): User
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session absente.');
        }

        return $user;
    }
}
