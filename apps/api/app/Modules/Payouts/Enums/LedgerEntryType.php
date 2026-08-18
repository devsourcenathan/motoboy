<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Enums;

/**
 * Nature d'une écriture au compte courant d'une agence (B4).
 *
 * Le type n'est pas décoratif : c'est lui qui distingue ce qui se rapporte à une
 * réservation — et attend donc que le départ soit parti pour devenir reversable —
 * de ce qui est reversable immédiatement, comme un ajustement qu'un
 * administrateur a écrit délibérément.
 *
 * Les écritures sont **immuables** : une erreur se corrige par une écriture
 * inverse, jamais par une modification. D'où les types de contre-passation.
 */
enum LedgerEntryType: string
{
    case BookingCredit = 'BOOKING_CREDIT';
    /** Course d'un appel de service, encaissee par la plateforme (E4 bis). */
    case RideCredit = 'RIDE_CREDIT';

    case CommissionDebit = 'COMMISSION_DEBIT';
    case RefundDebit = 'REFUND_DEBIT';

    /** La commission rémunère un transport qui n'a pas eu lieu (B5). */
    case CommissionReversalCredit = 'COMMISSION_REVERSAL_CREDIT';

    /** Frais réels récupérés sur les frais d'annulation retenus (B5). */
    case AggregatorFeeDebit = 'AGGREGATOR_FEE_DEBIT';

    case CounterCommissionDebit = 'COUNTER_COMMISSION_DEBIT';
    case CounterCommissionReversal = 'COUNTER_COMMISSION_REVERSAL';

    /** Correction manuelle — motif obligatoire, tracée à l'audit. */
    case Adjustment = 'ADJUSTMENT';

    case PayoutDebit = 'PAYOUT_DEBIT';

    /** Décaissement en échec : le débit écrit à l'envoi est contre-passé. */
    case PayoutReversalCredit = 'PAYOUT_REVERSAL_CREDIT';

    /**
     * Écritures reversables sans attendre qu'un départ soit parti.
     *
     * Un ajustement a été écrit délibérément par un administrateur, et les
     * mouvements de reversement soldent le compte : les retenir jusqu'à un
     * départ qu'ils ne concernent pas les laisserait indéfiniment en suspens.
     */
    public function isEligibleImmediately(): bool
    {
        return match ($this) {
            self::Adjustment, self::PayoutDebit, self::PayoutReversalCredit => true,
            default => false,
        };
    }
}
