<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Actions;

use App\Modules\Bookings\Models\Booking;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Commission;
use Illuminate\Support\Facades\DB;

/**
 * Inscrit une réservation payée au compte courant de l'agence (B4).
 *
 * Trois écritures, dans la même transaction que la confirmation : le crédit de
 * la réservation, le débit de la commission, et la ligne de commission
 * elle-même.
 *
 * **Les conditions viennent de la réservation, jamais de l'agence.** Elles y ont
 * été figées à la création : sans cela, renégocier un taux réécrirait
 * rétroactivement l'historique de toutes les réservations passées, y compris
 * celles déjà reversées et déjà justifiées par un relevé.
 */
final class RecordBookingSettlement
{
    /**
     * Les pourcentages sont exprimés en **points de base** : 800 vaut 8 %.
     *
     * Un pourcentage entier interdirait 8,5 %, et un flottant ferait entrer de
     * l'arrondi dans un calcul d'argent.
     */
    private const BASIS_POINTS = 10_000;

    public function handle(Booking $booking, Payment $payment): Commission
    {
        return DB::transaction(function () use ($booking, $payment): Commission {
            $amount = $this->computeCommission($booking);

            $commission = Commission::query()->create([
                'booking_id' => $booking->id,
                'agency_id' => $booking->agency_id,
                'base_amount' => $booking->total_amount,
                'type' => $booking->commission_type,
                'value' => $booking->commission_value,
                'amount' => $amount,
                'aggregator_fee_amount' => $payment->aggregator_fee_amount,
                'status' => 'ACCRUED',
            ]);

            AgencyLedgerEntry::query()->create([
                'agency_id' => $booking->agency_id,
                'booking_id' => $booking->id,
                'type' => 'BOOKING_CREDIT',
                'amount' => $booking->total_amount,
                'currency' => $booking->currency,
                'reference_type' => 'booking',
                'reference_id' => $booking->id,
                'description' => "Réservation {$booking->reference}",
                'occurred_at' => now(),
                'created_at' => now(),
            ]);

            AgencyLedgerEntry::query()->create([
                'agency_id' => $booking->agency_id,
                'booking_id' => $booking->id,
                'type' => 'COMMISSION_DEBIT',
                // Signé : le compte courant se calcule par somme, sans solde
                // stocké — un solde dénormalisé finit toujours par diverger.
                'amount' => -$amount,
                'currency' => $booking->currency,
                'reference_type' => 'commission',
                'reference_id' => $commission->id,
                'description' => "Commission sur {$booking->reference}",
                'occurred_at' => now(),
                'created_at' => now(),
            ]);

            return $commission;
        });
    }

    private function computeCommission(Booking $booking): int
    {
        return match ($booking->commission_type) {
            'FIXED' => min($booking->commission_value, $booking->total_amount),
            default => intdiv($booking->total_amount * $booking->commission_value, self::BASIS_POINTS),
        };
    }
}
