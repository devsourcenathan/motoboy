<?php

declare(strict_types=1);

use App\Modules\Bookings\Actions\ReleaseExpiredHolds;
use App\Modules\Trips\Actions\GenerateTrips;
use Illuminate\Support\Facades\Schedule;

/*
 * Libération des tenues expirées.
 *
 * **À la minute, et sans chevauchement.** PostgreSQL n'acceptant pas `now()`
 * dans le prédicat d'un index partiel, une tenue arrivée à terme reste
 * bloquante jusqu'au passage de ce job : sa fréquence *est* la durée maximale
 * d'indisponibilité fantôme acceptée en B2.
 *
 * `withoutOverlapping` évite que deux exécutions traitent la même réservation :
 * en mode capacité, le compteur reculerait deux fois et le départ afficherait
 * plus de places qu'il n'en a.
 */
Schedule::call(fn (ReleaseExpiredHolds $action) => $action->handle())
    // `name` doit précéder `withoutOverlapping` : le verrou est posé sous ce nom.
    ->name('bookings:release-expired-holds')
    ->everyMinute()
    ->withoutOverlapping();

/*
 * Génération des départs sur l'horizon glissant (I1).
 *
 * Quotidienne : c'est elle qui fait avancer la fenêtre de trente jours, et sans
 * elle l'offre se tarirait jour après jour sans que personne le remarque avant
 * que la recherche ne renvoie plus rien.
 */
Schedule::call(fn (GenerateTrips $action) => $action->handle())
    ->name('trips:generate')
    ->dailyAt('03:00')
    ->withoutOverlapping();
