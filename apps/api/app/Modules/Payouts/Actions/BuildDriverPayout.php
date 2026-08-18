<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Actions;

use App\Modules\Administration\Support\RidePayoutTerms;
use App\Modules\Payouts\Enums\LedgerEntryType;
use App\Modules\Payouts\Enums\PayoutStatus;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Payee;
use App\Modules\Payouts\Models\Payout;
use App\Modules\Payouts\Models\PayoutAccount;
use App\Modules\Payouts\Support\EligibleRideBalance;
use App\Modules\Rides\Models\Ride;
use App\Support\Reference;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Prepare le reversement du a un chauffeur (E4 bis).
 *
 * **Une action a part, et non `BuildPayout` generalisee** — le meme raisonnement
 * qui a donne `PayForRide` a cote d'`InitiatePayment`. Trois choses divergent :
 *
 * - le delai et le minimum viennent des **reglages de la plateforme** et non de
 *   conditions negociees, un chauffeur independant ne negociant pas ;
 * - l'eligibilite se juge sur la **fin de course**, pas sur un depart programme ;
 * - le releve se decompose par **course** et non par reservation.
 *
 * Les fondre aurait produit une action a deux jeux de gardes exclusifs — deux
 * actions dans un fichier, dont chaque lecteur aurait a deviner laquelle il lit.
 *
 * Ce qui ne change pas, et ne doit pas changer : **le calcul est automatique, le
 * declenchement est manuel**, et la somme du compte courant fait foi. Un
 * decaissement Mobile Money du mauvais montant est quasi irreversible.
 */
final class BuildDriverPayout
{
    public function __construct(private readonly RidePayoutTerms $terms) {}

    /**
     * @return array{payout: Payout|null, reason: string|null, balance: int}
     */
    public function handle(Payee $payee): array
    {
        // Un reversement en vol emporte un solde qui n'est pas encore solde : en
        // construire un second le compterait une seconde fois.
        $inFlight = Payout::query()
            ->where('payee_id', $payee->id)
            ->whereIn('status', $this->inFlightStatuses())
            ->exists();

        if ($inFlight) {
            return $this->skip('PAYOUT_IN_FLIGHT', 0);
        }

        $entries = EligibleRideBalance::query($payee->id, $this->terms->delayHours())->get();
        $balance = (int) $entries->sum('amount');

        if ($entries->isEmpty()) {
            return $this->skip('NOTHING_ELIGIBLE', 0);
        }

        // Un solde negatif ne se verse pas et ne s'efface pas : il reste au compte
        // courant et vient en deduction du prochain reversement. La dette suit le
        // chauffeur, ce qui est tout l'interet du compte courant.
        if ($balance <= 0) {
            return $this->skip('NEGATIVE_BALANCE', $balance);
        }

        if ($balance < $this->terms->minimumAmount()) {
            return $this->skip('BELOW_MINIMUM', $balance);
        }

        $account = $this->verifiedAccount($payee);

        if ($account === null) {
            return $this->skip('NO_VERIFIED_ACCOUNT', $balance);
        }

        return [
            'payout' => $this->write($payee, $account, $entries, $balance),
            'reason' => null,
            'balance' => $balance,
        ];
    }

    /**
     * @param  Collection<int, AgencyLedgerEntry>  $entries
     */
    private function write(
        Payee $payee,
        PayoutAccount $account,
        Collection $entries,
        int $balance,
    ): Payout {
        $breakdown = $this->breakdown($entries);

        $first = $entries->first();
        $currency = $first === null ? 'XAF' : (string) $first->currency;

        $recomposed = $breakdown['gross'] - $breakdown['commission']
            - $breakdown['refunds'] + $breakdown['adjustments'];

        /*
         * Meme garde que pour une agence : si le detail ne se recompose pas
         * exactement en net, on refuse d'ecrire plutot que de proposer un montant
         * qu'on ne saurait pas justifier devant le chauffeur.
         */
        if ($recomposed !== $balance) {
            throw new \RuntimeException(
                "Reversement du beneficiaire {$payee->id} : le detail ({$recomposed}) ne recompose pas ".
                "le solde eligible ({$balance}). Un type d'ecriture n'est pas classe — refus d'ecrire ".
                'plutot que de proposer un montant injustifiable.',
            );
        }

        return DB::transaction(function () use ($payee, $account, $entries, $balance, $breakdown, $currency): Payout {
            $payout = Payout::query()->create([
                'reference' => Reference::generate('PYT'),
                'payee_id' => $payee->id,
                // Aucune agence : c'est exactement ce que le beneficiaire permet.
                'agency_id' => null,
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
     * Le releve, ligne par course.
     *
     * C'est le document qui evite les reclamations repetees : un chauffeur qui
     * conteste un net doit pouvoir descendre jusqu'a la course qui l'explique.
     *
     * @param  Collection<int, AgencyLedgerEntry>  $entries
     */
    private function writeLines(Payout $payout, Collection $entries): void
    {
        $rideEntries = $entries->where('reference_type', Ride::class);

        foreach ($rideEntries->groupBy('reference_id') as $rideId => $lines) {
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
                'ride_id' => (int) $rideId,
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
                'gross' => $totals['gross'] += $amount,
                'commission' => $totals['commission'] += -$amount,
                'refunds' => $totals['refunds'] += -$amount,
                default => $totals['adjustments'] += $amount,
            };
        }

        return $totals;
    }

    /**
     * Classe chaque type dans une colonne du releve.
     *
     * `match` **exhaustif sans defaut implicite** : ajouter un type d'ecriture sans
     * le classer ici fait echouer l'analyse statique, avant meme la recomposition.
     */
    private function bucket(LedgerEntryType $type): string
    {
        return match ($type) {
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

    /**
     * Une erreur de saisie envoie l'argent a un inconnu, sans recours : le compte
     * doit avoir ete verifie. Le chauffeur le declare, un administrateur le verifie
     * — exactement comme pour une agence (B4).
     */
    private function verifiedAccount(Payee $payee): ?PayoutAccount
    {
        return PayoutAccount::query()
            ->where('payee_id', $payee->id)
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
