<?php

declare(strict_types=1);

namespace App\Modules\Administration\Actions;

use App\Modules\Administration\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Request as RequestFacade;

/**
 * Journalise une opération sensible (§28).
 *
 * **Appelée explicitement, jamais posée en observateur Eloquent.** Un
 * observateur voit qu'une ligne a changé, mais pas *pourquoi* ni *par qui* —
 * et c'est précisément la question à laquelle §28 demande de répondre : qui a
 * modifié ce prix, qui a validé ce billet, qui a changé ces coordonnées. Il
 * journaliserait en outre les écritures automatiques des jobs, noyant les gestes
 * humains dans le bruit.
 *
 * À journaliser impérativement : validation d'agence, modification des
 * coordonnées de reversement, modification des conditions commerciales,
 * approbation et envoi d'un reversement, ajustement manuel du compte courant,
 * annulation, remboursement.
 */
final class RecordAudit
{
    /**
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>|null  $new
     */
    public function handle(
        string $action,
        Model $subject,
        ?int $userId = null,
        ?array $old = null,
        ?array $new = null,
    ): AuditLog {
        return AuditLog::query()->create([
            // Null pour une action système — libération des tenues, génération
            // de départs, remboursement automatique.
            'user_id' => $userId,
            'action' => $action,
            'auditable_type' => $subject::class,
            'auditable_id' => $subject->getKey(),
            'old_values' => $old,
            'new_values' => $new,
            // L'adresse fait partie de la réponse à « qui » : un compte
            // compromis se reconnaît d'abord à l'endroit d'où il agit.
            'ip_address' => RequestFacade::ip(),
            'user_agent' => mb_substr((string) RequestFacade::userAgent(), 0, 255),
            'created_at' => now(),
        ]);
    }
}
