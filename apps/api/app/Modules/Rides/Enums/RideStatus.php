<?php

declare(strict_types=1);

namespace App\Modules\Rides\Enums;

/**
 * Le déroulé d'une course.
 *
 * Pas d'état « en route vers le passager » : sans suivi de position (E3), la
 * plateforme n'a aucun moyen de le vérifier, et un état qu'on ne peut pas
 * constater se désynchronise du terrain.
 */
enum RideStatus: string
{
    case Matched = 'MATCHED';
    case InProgress = 'IN_PROGRESS';
    case Completed = 'COMPLETED';
    case Cancelled = 'CANCELLED';

    /** Occupe le chauffeur : c'est ce que l'index partiel garde unique. */
    public function isActive(): bool
    {
        return $this === self::Matched || $this === self::InProgress;
    }
}
