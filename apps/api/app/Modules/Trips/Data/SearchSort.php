<?php

declare(strict_types=1);

namespace App\Modules\Trips\Data;

enum SearchSort: string
{
    /**
     * Le prix est un critère important du classement pour le MVP, et
     * l'algorithme pourra être amélioré pendant le développement (§11 du brief).
     *
     * En attendant : prix croissant, puis heure de départ. Départager par
     * l'heure évite qu'un tri sur le seul prix rende un ordre instable entre
     * départs au même tarif.
     */
    case Best = 'best';

    case PriceAsc = 'price_asc';
    case DepartureAsc = 'departure_asc';
    case DurationAsc = 'duration_asc';
}
