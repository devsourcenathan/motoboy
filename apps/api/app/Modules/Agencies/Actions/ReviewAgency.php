<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Actions;

use App\Modules\Administration\Actions\RecordAudit;
use App\Modules\Agencies\Models\Agency;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Support\Facades\DB;

/**
 * Validation ou refus d'une agence par l'administration (§23, I4).
 *
 * **Valider une agence ne vérifie pas ses coordonnées de reversement.** Ce sont
 * deux gestes distincts : les confondre ferait approuver un compte bancaire en
 * approuvant une raison sociale, alors que l'un dit « cette entreprise existe »
 * et l'autre « cet argent peut partir là ».
 */
final class ReviewAgency
{
    public function __construct(private readonly RecordAudit $audit) {}

    public function approve(Agency $agency, int $reviewerId): Agency
    {
        if ($agency->status !== 'PENDING') {
            throw ApiException::of(
                ErrorCode::AgencyNotPending,
                'Cette agence n\'est pas en attente de validation.',
                ['status' => $agency->status],
            );
        }

        return $this->apply($agency, 'APPROVED', $reviewerId, 'agency.approved');
    }

    /**
     * Le motif est obligatoire : un refus sans explication laisse l'agence sans
     * recours et fait revenir le même dossier à l'identique.
     */
    public function reject(Agency $agency, int $reviewerId, string $reason): Agency
    {
        return $this->apply($agency, 'REJECTED', $reviewerId, 'agency.rejected', $reason);
    }

    private function apply(
        Agency $agency,
        string $status,
        int $reviewerId,
        string $action,
        ?string $reason = null,
    ): Agency {
        $before = $agency->status;

        DB::transaction(function () use ($agency, $status, $reviewerId, $action, $before, $reason): void {
            $agency->update([
                'status' => $status,
                'approved_by' => $reviewerId,
                'approved_at' => $status === 'APPROVED' ? now() : null,
            ]);

            // §28 impose de tracer la validation d'une agence : c'est
            // l'opération qui ouvre le droit de publier une offre et
            // d'encaisser de l'argent au nom de la plateforme.
            $this->audit->handle(
                action: $action,
                subject: $agency,
                userId: $reviewerId,
                old: ['status' => $before],
                new: array_filter(['status' => $status, 'reason' => $reason]),
            );
        });

        return $agency->refresh();
    }
}
