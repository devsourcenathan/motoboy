<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Enums;

/**
 * Cycle de vie d'un reversement (B4).
 *
 * **Le calcul est automatique, le déclenchement est manuel.** Les premiers mois
 * produiront des cas non anticipés — remboursement arrivé en retard, réservation
 * contestée, coordonnées erronées. Un décaissement Mobile Money du mauvais
 * montant est quasi irréversible : la validation humaine reste le garde-fou tant
 * que le volume ne la rend pas impraticable.
 */
enum PayoutStatus: string
{
    case Draft = 'DRAFT';
    case PendingValidation = 'PENDING_VALIDATION';
    case Approved = 'APPROVED';
    case Processing = 'PROCESSING';
    case Paid = 'PAID';
    case Failed = 'FAILED';

    /**
     * Un reversement « en vol » interdit d'en construire un second pour la même
     * agence : le solde qu'il emporte n'est pas encore soldé, et le suivant le
     * compterait une seconde fois.
     */
    public function isInFlight(): bool
    {
        return match ($this) {
            self::Draft, self::PendingValidation, self::Approved, self::Processing => true,
            default => false,
        };
    }
}
