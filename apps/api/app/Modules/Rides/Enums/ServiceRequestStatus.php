<?php

declare(strict_types=1);

namespace App\Modules\Rides\Enums;

/**
 * Où en est un appel de service (E1).
 *
 * `OFFERED` existe pour que le passager sache qu'on lui répond : sans lui,
 * « ouverte » couvrirait aussi bien « personne n'a encore vu » que « trois
 * chauffeurs proposent », et l'écran ne saurait pas quoi dire.
 */
enum ServiceRequestStatus: string
{
    case Open = 'OPEN';
    case Offered = 'OFFERED';
    case Matched = 'MATCHED';
    case Cancelled = 'CANCELLED';

    /** Personne n'a répondu à temps. */
    case Expired = 'EXPIRED';

    /** Une offre ne se dépose que sur une demande encore en attente. */
    public function acceptsOffers(): bool
    {
        return $this === self::Open || $this === self::Offered;
    }
}
