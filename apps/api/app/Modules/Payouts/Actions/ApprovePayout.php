<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Actions;

use App\Modules\Payouts\Enums\PayoutStatus;
use App\Modules\Payouts\Models\Payout;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;

/**
 * Validation humaine d'un reversement (B4).
 *
 * **C'est le garde-fou, pas une formalité.** Un décaissement Mobile Money du
 * mauvais montant est quasi irréversible, et les premiers mois produiront des cas
 * non anticipés — remboursement arrivé en retard, réservation contestée,
 * coordonnées erronées. La validation reste manuelle tant que le volume ne la
 * rend pas impraticable.
 *
 * Approuver **n'envoie rien** : c'est un second geste, délibéré.
 */
final class ApprovePayout
{
    public function handle(Payout $payout, int $approvedBy): Payout
    {
        if (!in_array($payout->status, [PayoutStatus::Draft, PayoutStatus::PendingValidation], true)) {
            throw ApiException::of(
                ErrorCode::PayoutNotApprovable,
                'Ce reversement n\'est plus en attente de validation.',
                ['status' => $payout->status->value],
            );
        }

        $payout->update([
            'status' => PayoutStatus::Approved,
            'approved_by' => $approvedBy,
            'approved_at' => now(),
        ]);

        return $payout->refresh();
    }
}
