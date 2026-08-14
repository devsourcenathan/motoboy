<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Http\Resources;

use App\Modules\Payouts\Models\Payout;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Payout
 */
final class PayoutResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'reference' => $this->reference,
            'agency_id' => $this->agency_id,
            'period_start' => $this->period_start->toDateString(),
            'period_end' => $this->period_end->toDateString(),
            'status' => $this->status,
            'gross' => $this->money($this->gross_amount),
            'commission' => $this->money($this->commission_amount),
            'refunds' => $this->money($this->refund_amount),
            'adjustments' => $this->money($this->adjustment_amount),
            'net' => $this->money($this->net_amount),
            'approved_at' => $this->approved_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'provider_reference' => $this->provider_reference,
            'failure_reason' => $this->failure_reason,
        ];
    }

    /** @return array{amount: int, currency: string} */
    private function money(int $amount): array
    {
        return ['amount' => $amount, 'currency' => $this->currency];
    }
}
