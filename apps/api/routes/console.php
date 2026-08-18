<?php

declare(strict_types=1);

use App\Modules\Bookings\Actions\ReleaseExpiredHolds;
use App\Modules\Payments\Actions\ReconcilePayments;
use App\Modules\Payments\Actions\RetryFailedRefunds;
use App\Modules\Payouts\Actions\BuildDuePayouts;
use App\Modules\Rides\Actions\ExpireServiceRequests;
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
 * Fermeture des appels de service perimes (E1).
 *
 * L'expiration est deja vraie sans ecriture : une demande perimee n'accepte plus
 * d'offre avant meme ce balayage. Celui-ci rend l'etat **lisible** — un passager
 * doit voir « personne n'est venu » plutot qu'une demande eternellement en
 * attente. D'ou la minute : c'est un ecran qu'on regarde en attendant.
 */
Schedule::call(fn (ExpireServiceRequests $action) => $action->handle())
    ->name('rides:expire-service-requests')
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

/*
 * Rejeu des remboursements en échec (B5).
 *
 * Un remboursement en échec place le passager dans le pire état possible — sans
 * argent et sans billet. Il ne doit jamais rester silencieux : trois tentatives,
 * puis un état durable et une alerte journalisée.
 *
 * Toutes les dix minutes, pas à la minute : l'échec vient en général du compte
 * source, et réessayer plus vite ne le rendrait pas joignable.
 */
Schedule::call(fn (RetryFailedRefunds $action) => $action->handle())
    ->name('payments:retry-failed-refunds')
    ->everyTenMinutes()
    ->withoutOverlapping();

/*
 * Construction des reversements dus (B4).
 *
 * Quotidienne, mais chaque agence n'est retenue que le jour de sa cadence :
 * planifier une tâche par agence multiplierait les entrées sans rien ajouter.
 *
 * Le calcul est automatique, le **déclenchement reste manuel** — ce job ne verse
 * rien, il prépare des propositions à valider.
 */
Schedule::call(fn (BuildDuePayouts $action) => $action->handle())
    ->name('payouts:build-due')
    ->dailyAt('04:00')
    ->withoutOverlapping();

/*
 * Réconciliation des paiements (B4, I7).
 *
 * Sans ce contrôle, « le passager a payé mais n'a pas de billet » — webhook
 * perdu — ne se découvre jamais autrement que par une réclamation.
 */
Schedule::call(fn (ReconcilePayments $action) => $action->handle())
    ->name('payments:reconcile')
    ->dailyAt('05:00')
    ->withoutOverlapping();
