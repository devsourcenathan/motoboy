<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Http\Resources\PaymentResource;
use App\Modules\Rides\Actions\AcceptOffer;
use App\Modules\Rides\Actions\CancelServiceRequest;
use App\Modules\Rides\Actions\OpenServiceRequest;
use App\Modules\Rides\Actions\PayForRide;
use App\Modules\Rides\Actions\RefundRide;
use App\Modules\Rides\Http\Resources\RideResource;
use App\Modules\Rides\Http\Resources\ServiceRequestResource;
use App\Modules\Rides\Models\Ride;
use App\Modules\Rides\Models\RideOffer;
use App\Modules\Rides\Models\ServiceRequest;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
            ->with(['offers.driver.user', 'ride.driver.user', 'originCity', 'destinationCity'])
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'data' => $requests->getCollection()
                ->map(fn (ServiceRequest $service) => (new ServiceRequestResource($service))->resolve())
                ->all(),
            'meta' => [
                'page' => $requests->currentPage(),
                'per_page' => $requests->perPage(),
                'total' => $requests->total(),
                'last_page' => $requests->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, string $reference): JsonResponse
    {
        $service = $this->own($request, $reference);

        return response()->json(
            (new ServiceRequestResource($service->load([
                'offers.driver.user', 'ride.driver.user', 'originCity', 'destinationCity',
            ])))->resolve(),
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

    /**
     * Paie la course retenue.
     *
     * La cle d'idempotence est **portee par l'appelant** et conservee entre les
     * tentatives : la regenerer a chaque essai reviendrait a ne pas en avoir, et
     * un telephone qui perd le reseau juste apres l'envoi paierait deux fois.
     */
    public function pay(Request $request, string $reference, PayForRide $pay): JsonResponse
    {
        $ride = $this->ownRide($request, $reference);

        $validated = $request->validate([
            'method' => ['required', Rule::enum(PaymentMethod::class)],
            'operator' => ['nullable', 'string', 'max:32'],
            'payer_phone' => ['nullable', 'string', 'max:24'],
        ]);

        $key = $request->header('Idempotency-Key');

        if (!is_string($key) || $key === '') {
            throw ApiException::of(ErrorCode::ValidationFailed, 'En-tete Idempotency-Key requis.');
        }

        $payment = $pay->handle(
            $ride,
            PaymentMethod::from($validated['method']),
            $validated['operator'] ?? null,
            $validated['payer_phone'] ?? null,
            $key,
        );

        return response()->json((new PaymentResource($payment))->resolve(), 202);
    }

    /**
     * Le chauffeur ne s'est pas presente.
     *
     * Signale par le passager : c'est le seul a pouvoir le constater, faute de
     * suivi de position (E3). Rembourse integralement et marque le dossier.
     */
    public function reportNoShow(Request $request, string $reference, RefundRide $refunds): JsonResponse
    {
        $ride = $this->ownRide($request, $reference);
        $service = $ride->request;

        $refunds->onDriverNoShow($ride);

        if ($service !== null) {
            app(CancelServiceRequest::class)->handle(
                $service,
                $this->passenger($request),
                'Chauffeur non presente',
            );
        }

        return response()->json(
            (new RideResource($ride->refresh()->load('driver.user')))->resolve(),
        );
    }

    /** La course du passager, atteinte par sa reference et par sa session. */
    private function ownRide(Request $request, string $reference): Ride
    {
        $ride = Ride::query()
            ->where('reference', $reference)
            ->whereHas('request', fn ($query) => $query->where('user_id', $this->passenger($request)->id))
            ->first();

        if ($ride === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Course introuvable.');
        }

        return $ride;
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
