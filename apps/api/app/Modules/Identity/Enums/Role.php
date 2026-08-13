<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

/** Rôles amorcés du RBAC (§9 du brief). */
enum Role: string
{
    /** Rôles dont l'attribution est portée par une agence donnée. */
    public function isAgencyScoped(): bool
    {
        return match ($this) {
            self::Agency, self::Agent => true,
            default => false,
        };
    }
    case Passenger = 'PASSENGER';
    case Agency = 'AGENCY';

    /** Embarquement. Rôle fonctionnel, non lié à un métier — un chauffeur peut le porter (B3). */
    case Agent = 'AGENT';

    case Owner = 'OWNER';
    case Admin = 'ADMIN';
    case SuperAdmin = 'SUPER_ADMIN';
}
