<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Payments\Enums\RefundReason;
use App\Modules\Payments\Enums\RefundStatus;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Support\Reference;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Enregistre un remboursement.
 *
 * **Le remboursement part toujours vers le compte source du paiement**, jamais
 * vers un numéro déclaré après coup : sinon le circuit « je réserve, j'annule,
 * je me fais rembourser ailleurs » devient un vecteur de fraude immédiat (B5).
 * L'agrégateur reçoit la référence du paiement, pas une destination.
 *
 * L'exécution auprès du prestataire reste à câbler : elle dépend de son API de
 * remboursement, critère éliminatoire de la grille de [B4](../../../../../docs/BRIEF.md).
 * Le remboursement est donc créé en `PENDING` et attend son exécution — un état
 * honnête, pas un succès simulé.
 */
final class RefundPayment
{
    public function handle(
        Payment $payment,
        RefundReason $reason,
        string $description,
        ?int $amount = null,
    ): Refund {
        return DB::transaction(function () use ($payment, $reason, $description, $amount): Refund {
            $value = $amount ?? $payment->amount;

            $refund = Refund::query()->create([
                'reference' => Reference::generate('RFD'),
                'booking_id' => $payment->booking_id,
                'payment_id' => $payment->id,
                'amount' => $value,
                'currency' => $payment->currency,
                'reason' => $reason,
                'idempotency_key' => (string) Str::uuid(),
                'status' => RefundStatus::Pending,
                'retry_count' => 0,
            ]);

            $booking = $payment->booking;

            if ($booking !== null) {
                // Débit au compte courant : le remboursement se répercute sur
                // ce que l'agence percevra, quelle que soit la période où il
                // survient (B4).
                AgencyLedgerEntry::query()->create([
                    'agency_id' => $booking->agency_id,
                    'type' => 'REFUND_DEBIT',
                    'amount' => -$value,
                    'currency' => $payment->currency,
                    'reference_type' => 'refund',
                    'reference_id' => $refund->id,
                    'description' => $description,
                    'occurred_at' => now(),
                    'created_at' => now(),
                ]);
            }

            return $refund;
        });
    }
}
