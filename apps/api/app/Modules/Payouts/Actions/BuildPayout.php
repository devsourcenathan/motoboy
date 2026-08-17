<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Actions;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Payouts\Enums\LedgerEntryType;
use App\Modules\Payouts\Enums\PayoutStatus;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Payout;
use App\Modules\Payouts\Models\PayoutAccount;
use App\Modules\Payouts\Support\EligibleBalance;
use App\Support\Reference;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Prépare le reversement dû à une agence (B4).
 *
 * **Le calcul est automatique, le déclenchement est manuel.** Cette Action ne
 * verse rien : elle produit une proposition qu'un administrateur validera. Les
 * premiers mois produiront des cas non anticipés — remboursement arrivé en
 * retard, réservation contestée, coordonnées erronées — et un décaissement
 * Mobile Money du mauvais montant est quasi irréversible.
 *
 * **La somme du compte courant fait foi.** Le brut, la commission et les
 * remboursements affichés ne sont qu'une décomposition destinée au relevé ; si
 * elle ne se recompose pas exactement en net, on refuse d'écrire plutôt que de
 * proposer un montant qu'on ne saurait pas justifier devant l'agence.
 */
final class BuildPayout
{
    /**
     * @return array{payout: Payout|null, reason: string|null, balance: int}
     */
    public function handle(Agency $agency): array
    {
        $terms = $agency->commercialTerms;

        if ($terms === null) {
            return $this->skip('NOTHING_ELIGIBLE', 0);
        }

        // Un reversement en vol emporte un solde qui n'est pas encore soldé : en
        // construire un second le compterait une seconde fois.
        $inFlight = Payout::query()
            ->where('agency_id', $agency->id)
            ->whereIn('status', $this->inFlightStatuses())
            ->exists();

        if ($inFlight) {
            return $this->skip('PAYOUT_IN_FLIGHT', 0);
        }

        $entries = EligibleBalance::query($agency->id, $terms->payout_delay_hours)->get();
        $balance = (int) $entries->sum('amount');

        if ($entries->isEmpty()) {
            return $this->skip('NOTHING_ELIGIBLE', 0);
        }

        // Un solde négatif ne se verse pas et ne s'efface pas : il reste au
        // compte courant et vient en déduction du prochain reversement. La dette
        // suit l'agence, ce qui est tout l'intérêt du compte courant sur un
        // calcul par période.
        if ($balance <= 0) {
            return $this->skip('NEGATIVE_BALANCE', $balance);
        }

        if ($balance < $terms->payout_minimum_amount) {
            return $this->skip('BELOW_MINIMUM', $balance);
        }

        $account = $this->verifiedAccount($agency);

        if ($account === null) {
            return $this->skip('NO_VERIFIED_ACCOUNT', $balance);
        }

        return [
            'payout' => $this->write($agency, $account, $entries, $balance),
            'reason' => null,
            'balance' => $balance,
        ];
    }

    /**
     * @param  Collection<int, AgencyLedgerEntry>  $entries
     */
    private function write(
        Agency $agency,
        PayoutAccount $account,
        Collection $entries,
        int $balance,
    ): Payout {
        $breakdown = $this->breakdown($entries);

        $first = $entries->first();

        // La collection est non vide : `handle` l'a vérifié avant d'appeler ici.
        $currency = $first === null ? 'XAF' : (string) $first->currency;

        $recomposed = $breakdown['gross'] - $breakdown['commission']
            - $breakdown['refunds'] + $breakdown['adjustments'];

        if ($recomposed !== $balance) {
            throw new \RuntimeException(
                "Reversement de l'agence {$agency->id} : le détail ({$recomposed}) ne recompose pas ".
                "le solde éligible ({$balance}). Un type d'écriture n'est pas classé — refus d'écrire ".
                'plutôt que de proposer un montant injustifiable.',
            );
        }

        return DB::transaction(function () use ($agency, $account, $entries, $balance, $breakdown, $currency): Payout {
            $payout = Payout::query()->create([
                'reference' => Reference::generate('PYT'),
                'agency_id' => $agency->id,
                // La période décrit ce qui est couvert, pas une fenêtre de
                // calcul : le compte courant n'en a pas.
                'period_start' => $entries->min('occurred_at'),
                'period_end' => $entries->max('occurred_at'),
                'gross_amount' => $breakdown['gross'],
                'commission_amount' => $breakdown['commission'],
                'refund_amount' => $breakdown['refunds'],
                'adjustment_amount' => $breakdown['adjustments'],
                'net_amount' => $balance,
                'currency' => $currency,
                'payout_account_id' => $account->id,
                'status' => PayoutStatus::PendingValidation,
            ]);

            $this->writeLines($payout, $entries);

            return $payout;
        });
    }

    /**
     * Le relevé, ligne par réservation.
     *
     * C'est le document qui évite les litiges répétés sur les montants : une
     * agence qui conteste un net doit pouvoir descendre jusqu'à la réservation
     * qui l'explique.
     *
     * @param  Collection<int, AgencyLedgerEntry>  $entries
     */
    private function writeLines(Payout $payout, Collection $entries): void
    {
        foreach ($entries->whereNotNull('booking_id')->groupBy('booking_id') as $bookingId => $lines) {
            $gross = 0;
            $commission = 0;
            $refunds = 0;

            foreach ($lines as $entry) {
                match ($this->bucket($entry->type)) {
                    'gross' => $gross += (int) $entry->amount,
                    'commission' => $commission += -(int) $entry->amount,
                    default => $refunds += -(int) $entry->amount,
                };
            }

            $payout->lines()->create([
                'booking_id' => (int) $bookingId,
                'gross_amount' => $gross,
                'commission_amount' => $commission,
                'refund_amount' => $refunds,
                'net_amount' => $gross - $commission - $refunds,
            ]);
        }
    }

    /**
     * @param  Collection<int, AgencyLedgerEntry>  $entries
     * @return array{gross: int, commission: int, refunds: int, adjustments: int}
     */
    private function breakdown(Collection $entries): array
    {
        $totals = ['gross' => 0, 'commission' => 0, 'refunds' => 0, 'adjustments' => 0];

        foreach ($entries as $entry) {
            $amount = (int) $entry->amount;

            match ($this->bucket($entry->type)) {
                // Les débits sont stockés signés ; la décomposition les présente
                // en valeurs positives, comme sur un relevé.
                'gross' => $totals['gross'] += $amount,
                'commission' => $totals['commission'] += -$amount,
                'refunds' => $totals['refunds'] += -$amount,
                default => $totals['adjustments'] += $amount,
            };
        }

        return $totals;
    }

    /**
     * Classe chaque type dans une colonne du relevé.
     *
     * Le `match` est **exhaustif sans défaut implicite** : ajouter un type
     * d'écriture sans le classer ici ferait échouer la recomposition, et le
     * reversement serait refusé plutôt que faux.
     */
    private function bucket(LedgerEntryType $type): string
    {
        return match ($type) {
            // Une course d'appel de service est du chiffre brut, comme une
            // reservation : c'est ce que le beneficiaire a fait entrer.
            LedgerEntryType::BookingCredit,
            LedgerEntryType::RideCredit => 'gross',
            LedgerEntryType::CommissionDebit,
            LedgerEntryType::CommissionReversalCredit,
            LedgerEntryType::CounterCommissionDebit,
            LedgerEntryType::CounterCommissionReversal => 'commission',
            LedgerEntryType::RefundDebit,
            LedgerEntryType::AggregatorFeeDebit => 'refunds',
            LedgerEntryType::Adjustment,
            LedgerEntryType::PayoutDebit,
            LedgerEntryType::PayoutReversalCredit => 'adjustments',
        };
    }

    private function verifiedAccount(Agency $agency): ?PayoutAccount
    {
        // Une erreur de saisie envoie l'argent à un inconnu, sans recours : le
        // compte doit avoir été vérifié à la validation de l'agence (B4).
        return PayoutAccount::query()
            ->where('agency_id', $agency->id)
            ->where('is_active', true)
            ->whereNotNull('verified_at')
            ->first();
    }

    /** @return list<string> */
    private function inFlightStatuses(): array
    {
        return array_values(array_map(
            static fn (PayoutStatus $status): string => $status->value,
            array_filter(PayoutStatus::cases(), static fn (PayoutStatus $s): bool => $s->isInFlight()),
        ));
    }

    /** @return array{payout: null, reason: string, balance: int} */
    private function skip(string $reason, int $balance): array
    {
        return ['payout' => null, 'reason' => $reason, 'balance' => $balance];
    }
}
