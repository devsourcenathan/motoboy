<?php

declare(strict_types=1);

namespace App\Modules\Rides\Actions;

use App\Modules\Administration\Actions\RecordAudit;
use App\Modules\Identity\Models\User;
use App\Modules\Rides\Enums\DriverDocumentType;
use App\Modules\Rides\Enums\DriverStatus;
use App\Modules\Rides\Models\DriverDocument;
use App\Modules\Rides\Models\DriverProfile;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Support\Facades\DB;

/**
 * Instruction d'un dossier chauffeur (E2).
 *
 * Validation, refus motivé, suspension motivée. **Tracé au journal d'audit** :
 * c'est une décision prise sur le compte d'un autre, et §28 existe précisément
 * pour savoir qui l'a prise et d'où.
 */
final class ReviewDriverApplication
{
    public function __construct(private readonly RecordAudit $audit) {}

    /**
     * Valide le dossier.
     *
     * **Refuse un dossier incomplet.** Les quatre pièces sont ce dont la
     * plateforme dispose en cas d'incident, faute d'agence pour en répondre :
     * valider sans elles reviendrait à n'avoir rien vérifié tout en l'ayant
     * écrit.
     */
    public function approve(DriverProfile $profile, User $reviewer): DriverProfile
    {
        $missing = $this->missingDocuments($profile);

        if ($missing !== []) {
            throw ApiException::of(
                ErrorCode::ValidationFailed,
                'Dossier incomplet : '.implode(', ', $missing).'.',
            );
        }

        return $this->settle($profile, $reviewer, DriverStatus::Approved, null, 'driver.approved');
    }

    public function reject(DriverProfile $profile, User $reviewer, string $note): DriverProfile
    {
        return $this->settle($profile, $reviewer, DriverStatus::Rejected, $note, 'driver.rejected');
    }

    /**
     * Suspend un chauffeur validé.
     *
     * Distinct du refus : le refus porte sur un dossier jamais accepté. Ni l'un
     * ni l'autre ne touche à l'historique des courses ou aux reversements dus —
     * suspendre n'est pas effacer.
     */
    public function suspend(DriverProfile $profile, User $reviewer, string $note): DriverProfile
    {
        return $this->settle($profile, $reviewer, DriverStatus::Suspended, $note, 'driver.suspended');
    }

    /** @return list<string> */
    private function missingDocuments(DriverProfile $profile): array
    {
        /*
         * `pluck` applique les casts d'Eloquent : la colonne revient en
         * énumération, pas en chaîne. Comparer les deux avec `in_array` strict
         * ne correspondait jamais, et un dossier complet était déclaré vide.
         */
        $present = $profile->documents()->get()
            ->map(fn (DriverDocument $document): string => $document->type->value)
            ->all();

        return array_values(array_map(
            fn (DriverDocumentType $type): string => $type->value,
            array_filter(
                DriverDocumentType::cases(),
                fn (DriverDocumentType $type): bool => !in_array($type->value, $present, true),
            ),
        ));
    }

    private function settle(
        DriverProfile $profile,
        User $reviewer,
        DriverStatus $status,
        ?string $note,
        string $action,
    ): DriverProfile {
        $before = $profile->status;

        return DB::transaction(function () use ($profile, $reviewer, $status, $note, $action, $before): DriverProfile {
            $profile->update([
                'status' => $status,
                'review_note' => $note,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
            ]);

            $this->audit->handle(
                action: $action,
                subject: $profile,
                userId: $reviewer->id,
                old: ['status' => $before->value],
                new: ['status' => $status->value, 'note' => $note],
            );

            return $profile->refresh();
        });
    }
}
