<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

/** Rôles amorcés du RBAC (§9 du brief). */
enum Role: string
{
    case Passenger = 'PASSENGER';
    case Agency = 'AGENCY';

    /** Embarquement. Rôle fonctionnel, non lié à un métier — un chauffeur peut le porter (B3). */
    case Agent = 'AGENT';

    /**
     * Chauffeur indépendant de l'appel de service (E2).
     *
     * Porté par un compte passager ordinaire : un chauffeur reste un passager
     * quand il voyage, et lui imposer un second compte le ferait ressaisir son
     * numéro pour la même personne. Il n'est **pas** rattaché à une agence —
     * c'est ce qui le distingue du chauffeur salarié de `drivers`.
     */
    case Driver = 'DRIVER';

    case Owner = 'OWNER';
    case Admin = 'ADMIN';
    case SuperAdmin = 'SUPER_ADMIN';

    /** Rôles dont l'attribution est portée par une agence donnée. */
    public function isAgencyScoped(): bool
    {
        return match ($this) {
            self::Agency, self::Agent => true,
            default => false,
        };
    }
}
