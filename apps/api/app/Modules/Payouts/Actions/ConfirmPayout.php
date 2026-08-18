<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Actions;

use App\Modules\Payouts\Data\DisbursementEvent;
use App\Modules\Payouts\Enums\LedgerEntryType;
use App\Modules\Payouts\Enums\PayoutStatus;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Payout;
use Illuminate\Support\Facades\DB;

/**
 * Applique le verdict du prestataire sur un décaissement (B4).
 *
 * **C'est ce qui fait sortir un reversement de `PROCESSING`.** Un reversement en
 * vol interdisant d'en construire un second, sans cet état terminal l'agence ne
 * serait plus jamais payée.
 *
 * Rejouable sans effet supplémentaire : les prestataires réémettent.
 */
final class ConfirmPayout
{
    public function handle(DisbursementEvent $event): ?Payout
    {
        $payout = Payout::query()
            ->where('provider_reference', $event->providerReference)
            ->first();

        if ($payout === null) {
            return null;
        }

        // Déjà tranché : ni seconde date de paiement, ni seconde
        // contre-passation.
        if (!$payout->status->isInFlight()) {
            return $payout;
        }

        DB::transaction(function () use ($payout, $event): void {
            $payout->update([
                'status' => $event->status,
                'paid_at' => $event->status === PayoutStatus::Paid ? now() : null,
                'failure_reason' => $event->failureReason === null
                    ? null
                    : mb_substr($event->failureReason, 0, 255),
            ]);

            if ($event->status === PayoutStatus::Failed) {
                // Le débit écrit à l'envoi est contre-passé : sans cela l'agence
                // apparaîtrait payée alors qu'elle ne l'est pas, et le solde lui
                // serait retiré sans qu'elle l'ait jamais reçu.
                AgencyLedgerEntry::query()->create([
                    'payee_id' => $payout->payee_id,
                    'agency_id' => $payout->agency_id,
                    'booking_id' => null,
                    'type' => LedgerEntryType::PayoutReversalCredit,
                    'amount' => $payout->net_amount,
                    'currency' => $payout->currency,
                    'reference_type' => 'payout',
                    'reference_id' => $payout->id,
                    'description' => "Reversement {$payout->reference} en échec",
                    'occurred_at' => now(),
                    'created_at' => now(),
                ]);
            }
        });

        return $payout->refresh();
    }
}
