<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Resources;

use App\Modules\Payments\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Conforme au schéma `Payment` de `docs/openapi.yaml`, qui est normatif.
 *
 * @mixin Payment
 */
final class PaymentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $payment = $this->resource;

        return [
            'reference' => $payment->reference,
            'booking_reference' => $payment->booking?->reference,
            'status' => $payment->status,
            'method' => $payment->method,
            'operator' => $payment->operator,
            'amount' => ['amount' => $payment->amount, 'currency' => $payment->currency],
            'failure_reason' => $payment->failure_reason,
            'paid_at' => $payment->paid_at?->toIso8601String(),
            'created_at' => $payment->created_at?->toIso8601String(),
        ];
    }
}
