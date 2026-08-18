<?php

declare(strict_types=1);

namespace App\Modules\Rides\Actions;

use App\Modules\Administration\Support\RideCommission;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payouts\Enums\LedgerEntryType;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Payee;
use App\Modules\Rides\Models\Ride;
use Illuminate\Support\Facades\DB;

/**
 * Ce que la course doit au chauffeur (E4 bis).
 *
 * Deux écritures : le prix encaissé au crédit, la commission au débit. Le solde
 * du chauffeur est **la somme de ses écritures** — aucun total n'est stocké, pour
 * la même raison qu'aux agences (B4) : un solde dénormalisé finit par diverger de
 * ses écritures, et la divergence se découvre lors d'une réclamation.
 *
 * C'est ici que le bénéficiaire généralisé de l'étape 1 paie : le grand livre ne
 * sait pas qu'il vient d'écrire pour une personne plutôt qu'une agence.
 */
final class RecordRideSettlement
{
    public function __construct(private readonly RideCommission $commission) {}

    /**
     * Rejouable sans effet supplémentaire.
     *
     * Terminer une course deux fois — un appareil qui réémet, une reprise
     * manuelle — ne doit pas créditer deux fois. L'absence d'écriture existante
     * fait office de garde.
     */
    public function handle(Ride $ride): void
    {
        $paid = Payment::query()
            ->where('ride_id', $ride->id)
            ->where('status', PaymentStatus::Succeeded->value)
            ->exists();

        /*
         * Rien n'a été encaissé : il n'y a rien à reverser. Créditer quand même
         * ferait devoir au chauffeur un argent que la plateforme n'a pas reçu —
         * l'erreur la plus chère de tout le module.
         */
        if (!$paid) {
            return;
        }

        $payee = Payee::forUser((int) $ride->driver?->user_id);

        $already = AgencyLedgerEntry::query()
            ->where('payee_id', $payee->id)
            ->where('reference_type', Ride::class)
            ->where('reference_id', $ride->id)
            ->exists();

        if ($already) {
            return;
        }

        DB::transaction(function () use ($ride, $payee): void {
            $commission = $this->commission->on($ride->price_amount);

            $this->write($ride, $payee, LedgerEntryType::RideCredit, $ride->price_amount);

            // Débit séparé plutôt qu'un crédit net : le chauffeur doit pouvoir
            // lire ce qu'il a gagné **et** ce qui a été prélevé. Un net seul
            // transforme chaque question en réclamation.
            if ($commission > 0) {
                $this->write($ride, $payee, LedgerEntryType::CommissionDebit, -$commission);
            }
        });
    }

    private function write(Ride $ride, Payee $payee, LedgerEntryType $type, int $amount): void
    {
        AgencyLedgerEntry::query()->create([
            // `agency_id` reste renseigné par le pont transitoire de l'étape 1 ;
            // il ne l'est pas ici, la course n'ayant pas d'agence. C'est
            // exactement ce que le bénéficiaire permet.
            'payee_id' => $payee->id,
            'type' => $type,
            'amount' => $amount,
            'currency' => $ride->currency,
            'reference_type' => Ride::class,
            'reference_id' => $ride->id,
            'description' => "Course {$ride->reference}",
            'occurred_at' => now(),
        ]);
    }
}
