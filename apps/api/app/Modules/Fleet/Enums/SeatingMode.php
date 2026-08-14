<?php

declare(strict_types=1);

namespace App\Modules\Fleet\Enums;

/**
 * Deux modes d'inventaire (§13 du brief), volontairement asymétriques.
 *
 * `Seated` s'appuie sur l'index unique partiel de `booking_passengers` : l'index
 * *est* la sérialisation, deux réservations concurrentes du même siège entrent
 * en conflit au niveau de la base.
 *
 * `Capacity` s'appuie sur un verrou de ligne du départ et la contrainte
 * `seats_taken <= capacity`.
 *
 * Un mécanisme unique aurait imposé de matérialiser une ligne par siège et par
 * départ — de l'ordre de 12 600 lignes par liaison et par mois, dont la
 * quasi-totalité jamais vendue.
 */
enum SeatingMode: string
{
    case Seated = 'SEATED';
    case Capacity = 'CAPACITY';
}
