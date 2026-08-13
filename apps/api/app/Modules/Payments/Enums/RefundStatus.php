<?php

declare(strict_types=1);

namespace App\Modules\Payments\Enums;

enum RefundStatus: string
{
    case Pending = 'PENDING';
    case Processing = 'PROCESSING';
    case Completed = 'COMPLETED';

    /**
     * Le pire état possible pour un passager : sans argent et sans billet. Un
     * remboursement en échec est rejoué automatiquement, puis remonté en alerte
     * à l'administration. Jamais laissé silencieux (B5 du brief).
     */
    case Failed = 'FAILED';
}
