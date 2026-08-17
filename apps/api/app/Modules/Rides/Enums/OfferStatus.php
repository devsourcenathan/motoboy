<?php

declare(strict_types=1);

namespace App\Modules\Rides\Enums;

/**
 * Le sort d'une offre de chauffeur.
 *
 * `DECLINED` couvre les offres non retenues, pas seulement les refus explicites :
 * accepter une offre écarte les autres, et le chauffeur doit savoir qu'il a perdu
 * plutôt que d'attendre.
 */
enum OfferStatus: string
{
    case Pending = 'PENDING';
    case Accepted = 'ACCEPTED';
    case Declined = 'DECLINED';
    case Expired = 'EXPIRED';
}
