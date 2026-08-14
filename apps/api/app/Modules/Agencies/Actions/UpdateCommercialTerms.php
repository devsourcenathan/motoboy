<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Actions;

use App\Modules\Administration\Actions\RecordAudit;
use App\Modules\Agencies\Models\Agency;
use App\Modules\Agencies\Models\AgencyCommercialTerms;
use Illuminate\Support\Facades\DB;

/**
 * Conditions commerciales d'une agence (B4, §23).
 *
 * Ce sont des **termes négociés**, définis par l'administration et modifiables
 * par elle seule — pas un réglage en libre-service.
 *
 * **Modifier ces conditions ne réécrit aucune réservation existante.** Elles y
 * sont recopiées à la création : sans ce figement, renégocier un taux réécrirait
 * rétroactivement l'historique financier de toutes les réservations passées, y
 * compris celles déjà reversées et déjà justifiées à l'agence par un relevé.
 */
final class UpdateCommercialTerms
{
    public function __construct(private readonly RecordAudit $audit) {}

    /** @param array<string, mixed> $changes */
    public function handle(Agency $agency, array $changes, int $userId): AgencyCommercialTerms
    {
        $terms = $agency->commercialTerms ?? AgencyCommercialTerms::query()->create([
            'agency_id' => $agency->id,
        ]);

        $before = array_intersect_key($terms->getAttributes(), $changes);

        DB::transaction(function () use ($terms, $changes, $userId, $before): void {
            $terms->update($changes);

            // §28 impose de tracer la modification des conditions commerciales :
            // c'est ce qui détermine combien MOTOBOY prélève, et une agence qui
            // conteste doit pouvoir savoir quand et par qui le taux a changé.
            $this->audit->handle(
                action: 'commercial_terms.updated',
                subject: $terms,
                userId: $userId,
                old: $before,
                new: $changes,
            );
        });

        return $terms->refresh();
    }
}
