<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Actions;

use App\Modules\Administration\Actions\RecordAudit;
use App\Modules\Agencies\Models\Agency;
use App\Modules\Payouts\Enums\LedgerEntryType;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Payee;
use Illuminate\Support\Facades\DB;

/**
 * Correction manuelle du compte courant (B4, §23).
 *
 * **Motif obligatoire, journalisé.** C'est ce qui permet de rattraper les cas
 * que les premiers mois produiront — remboursement hors circuit, geste
 * commercial, erreur de saisie corrigée. Sans cette porte, un compte courant
 * faux ne se corrigerait que par requête SQL, c'est-à-dire sans trace et sans
 * auteur.
 *
 * L'écriture est **signée** et, comme toutes les autres, immuable : une erreur
 * d'ajustement se corrige par un second ajustement, jamais par une modification.
 */
final class AdjustLedger
{
    public function __construct(private readonly RecordAudit $audit) {}

    public function handle(Agency $agency, int $amount, string $description, int $userId): AgencyLedgerEntry
    {
        return DB::transaction(function () use ($agency, $amount, $description, $userId): AgencyLedgerEntry {
            $entry = AgencyLedgerEntry::query()->create([
                'payee_id' => Payee::forAgency($agency->id)->id,
                'agency_id' => $agency->id,
                // Aucune réservation en face : un ajustement est reversable
                // immédiatement, sans attendre qu'un départ soit parti.
                'booking_id' => null,
                'type' => LedgerEntryType::Adjustment,
                'amount' => $amount,
                'currency' => 'XAF',
                'reference_type' => 'agency',
                'reference_id' => $agency->id,
                'description' => $description,
                'created_by' => $userId,
                'occurred_at' => now(),
                'created_at' => now(),
            ]);

            $this->audit->handle(
                action: 'ledger.adjusted',
                subject: $entry,
                userId: $userId,
                new: ['amount' => $amount, 'description' => $description],
            );

            return $entry;
        });
    }
}
