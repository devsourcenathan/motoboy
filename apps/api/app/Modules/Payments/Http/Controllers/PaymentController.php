<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Controllers;

use App\Modules\Bookings\Models\Booking;
use App\Modules\Payments\Actions\InitiatePayment;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Http\Requests\InitiatePaymentRequest;
use App\Modules\Payments\Http\Resources\PaymentResource;
use App\Modules\Payments\Models\Payment;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PaymentController
{
    public function store(
        InitiatePaymentRequest $request,
        string $reference,
        InitiatePayment $initiate,
    ): JsonResponse {
        $booking = Booking::query()->where('reference', $reference)->firstOrFail();

        $this->authorizeOwnership($booking->user_id, $request);

        $payment = $initiate->handle(
            booking: $booking,
            method: PaymentMethod::from($request->string('method')->toString()),
            operator: $request->filled('operator') ? $request->string('operator')->toString() : null,
            payerPhone: $request->filled('payer_phone') ? $request->string('payer_phone')->toString() : null,
            idempotencyKey: $request->idempotencyKey(),
        );

        /*
         * 202 et non 201 : le paiement est **accepté**, pas abouti. En Mobile
         * Money le passager doit encore saisir son code, et c'est le webhook qui
         * tranchera.
         *
         * **Sauf quand tout est déjà joué.** Un refus immédiat de l'agrégateur —
         * numéro invalide, opérateur indisponible — clôt la tentative avant
         * qu'aucune sollicitation ne parte : rien n'arrivera plus par webhook.
         * Rendre `202` dans ce cas fait lire « accepté » sur un échec, et c'est
         * exactement ce qui s'est produit en production : le journal montrait un
         * `202` rassurant pendant que l'écran affichait « paiement non abouti ».
         * Le corps disait vrai, le code de statut mentait.
         */
        $settled = $payment->status === PaymentStatus::Failed;

        return response()->json((new PaymentResource($payment))->resolve(), $settled ? 200 : 202);
    }

    public function show(Request $request, string $reference): JsonResponse
    {
        $payment = Payment::query()
            ->where('reference', $reference)
            ->with('booking')
            ->firstOrFail();

        $this->authorizeOwnership($payment->booking?->user_id, $request);

        return response()->json((new PaymentResource($payment))->resolve());
    }

    private function authorizeOwnership(?int $ownerId, Request $request): void
    {
        if ($ownerId !== $request->user()?->getAuthIdentifier()) {
            throw ApiException::of(ErrorCode::Forbidden, 'Cette ressource ne vous appartient pas.');
        }
    }
}
