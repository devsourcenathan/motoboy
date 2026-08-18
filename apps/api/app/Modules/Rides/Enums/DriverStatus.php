<?php

declare(strict_types=1);

namespace App\Modules\Rides\Enums;

/**
 * Où en est le dossier d'un chauffeur indépendant (E2).
 *
 * Un seul de ces états autorise à rouler. C'est délibéré : sans agence
 * derrière, la validation du dossier est la seule barrière entre la plateforme
 * et un chauffeur dont personne n'a vérifié le permis.
 */
enum DriverStatus: string
{
    case Pending = 'PENDING';
    case Approved = 'APPROVED';
    case Rejected = 'REJECTED';

    /**
     * Suspendu après validation.
     *
     * Distinct du refus : le refus porte sur un dossier qu'on n'a jamais
     * accepté, la suspension retire un droit accordé. L'historique et les
     * reversements dus survivent aux deux.
     */
    case Suspended = 'SUSPENDED';

    /** Seul un dossier validé permet de répondre à une demande. */
    public function canDrive(): bool
    {
        return $this === self::Approved;
    }
}
