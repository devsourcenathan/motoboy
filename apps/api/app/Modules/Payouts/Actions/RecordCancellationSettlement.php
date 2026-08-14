<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Actions;

use App\Modules\Bookings\Models\Booking;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payouts\Models\AgencyLedgerEntry;

/**
 * Répartition des frais d'annulation au compte courant (B5).
 *
 * Le crédit de la réservation et le débit de la commission sont déjà passés à la
 * confirmation (`RecordBookingSettlement`). L'annulation ne les efface pas : un
 * compte courant se corrige par contre-passation, jamais par réécriture, sans
 * quoi un relevé déjà envoyé à l'agence cesserait de correspondre à ses lignes.
 *
 * Deux écritures s'ajoutent au débit du remboursement lui-même :
 *
 * 1. **La commission revient à l'agence.** Elle rémunère un transport qui a eu
 *    lieu ; la prélever sur un voyage qui n'a pas eu lieu serait indéfendable
 *    face à une agence, pour des montants dérisoires.
 * 2. **MOTOBOY récupère ses frais réels d'agrégateur**, dans la limite des frais
 *    d'annulation retenus. Ils ont bien été engagés et n'ont pas à être
 *    supportés par la plateforme.
 *
 * **Le solde reste à l'agence**, qui subit la perte réelle du siège — sans
 * écriture, c'est ce que le débit du remboursement laisse en place.
 *
 * Si les frais retenus sont **inférieurs** aux frais d'agrégateur, MOTOBOY
 * absorbe la différence : c'est le plafonnement par `min()` ci-dessous.
 */
final class RecordCancellationSettlement
{
    public function handle(Booking $booking, ?Payment $payment, Refund $refund): void
    {
        $this->reverseCommission($booking, $refund);
        $this->recoverCollectionFee($booking, $payment, $refund);
    }

    /**
     * Coût réel du remboursement, connu seulement quand le prestataire l'a
     * exécuté — jamais au moment de l'annulation.
     *
     * Il vient donc en écriture séparée, plafonné par ce qui n'a pas déjà été
     * récupéré sur les frais retenus. Au-delà, MOTOBOY absorbe.
     */
    public function recordRefundFee(Refund $refund, int $feeAmount): void
    {
        $booking = $refund->booking;

        if ($feeAmount <= 0 || $booking === null) {
            return;
        }

        $headroom = $refund->fee_amount - $this->alreadyRecovered($refund);
        $recoverable = min($feeAmount, max(0, $headroom));

        if ($recoverable <= 0) {
            return;
        }

        $this->debitFee(
            $booking,
            $refund,
            $recoverable,
            "Frais de remboursement {$refund->reference}",
        );
    }

    private function reverseCommission(Booking $booking, Refund $refund): void
    {
        $commission = $booking->commission()->first();

        if ($commission === null || $booking->seats_count <= 0) {
            return;
        }

        // Au prorata : annuler une place sur trois ne rend que le tiers de la
        // commission, les deux autres places voyageant normalement.
        $amount = intdiv($commission->amount * $refund->seats_count, $booking->seats_count);

        if ($amount <= 0) {
            return;
        }

        AgencyLedgerEntry::query()->create([
            'agency_id' => $booking->agency_id,
            'booking_id' => $booking->id,
            'type' => 'COMMISSION_REVERSAL_CREDIT',
            'amount' => $amount,
            'currency' => $booking->currency,
            'reference_type' => 'refund',
            'reference_id' => $refund->id,
            'description' => "Commission abandonnée sur {$booking->reference}",
            'occurred_at' => now(),
            'created_at' => now(),
        ]);
    }

    private function recoverCollectionFee(Booking $booking, ?Payment $payment, Refund $refund): void
    {
        if ($payment === null || $booking->seats_count <= 0) {
            return;
        }

        // Au prorata des places annulées : sans cela, annuler une place sur
        // trois ferait récupérer à MOTOBOY les frais de collecte de la
        // réservation entière.
        $collection = intdiv($payment->aggregator_fee_amount * $refund->seats_count, $booking->seats_count);
        $recoverable = min($collection, $refund->fee_amount);

        if ($recoverable <= 0) {
            return;
        }

        $this->debitFee(
            $booking,
            $refund,
            $recoverable,
            "Frais d'encaissement retenus sur {$booking->reference}",
        );
    }

    private function debitFee(Booking $booking, Refund $refund, int $amount, string $description): void
    {
        AgencyLedgerEntry::query()->create([
            'agency_id' => $booking->agency_id,
            'booking_id' => $booking->id,
            'type' => 'AGGREGATOR_FEE_DEBIT',
            'amount' => -$amount,
            'currency' => $refund->currency,
            'reference_type' => 'refund',
            'reference_id' => $refund->id,
            'description' => $description,
            'occurred_at' => now(),
            'created_at' => now(),
        ]);
    }

    private function alreadyRecovered(Refund $refund): int
    {
        $recovered = AgencyLedgerEntry::query()
            ->where('type', 'AGGREGATOR_FEE_DEBIT')
            ->where('reference_type', 'refund')
            ->where('reference_id', $refund->id)
            ->sum('amount');

        return abs((int) $recovered);
    }
}
