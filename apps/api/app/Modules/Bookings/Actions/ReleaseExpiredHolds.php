<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Actions;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Trips\Models\Trip;
use Illuminate\Support\Facades\DB;

/**
 * Libère les places dont la tenue est arrivée à terme.
 *
 * **Sans ce job, l'inventaire se gèle.** Un paiement Mobile Money abandonné —
 * cas fréquent — immobiliserait la place indéfiniment, et un car afficherait
 * complet sans avoir vendu un billet.
 *
 * La libération est portée par un job, jamais par un calcul effectué à la
 * lecture : l'index unique partiel s'appuie sur `holds_seat`, qu'il faut donc
 * réellement remettre à `false` en base (B2).
 *
 * PostgreSQL n'acceptant pas `now()` dans le prédicat d'un index partiel, une
 * tenue expirée reste bloquante jusqu'au passage du job — d'où une exécution à
 * la minute, et jusqu'à une minute d'indisponibilité fantôme explicitement
 * acceptée.
 */
final class ReleaseExpiredHolds
{
    /** @return int Nombre de réservations libérées. */
    public function handle(): int
    {
        $expired = Booking::query()
            ->expiredHolds()
            ->with('trip')
            ->limit(500)
            ->get();

        $released = 0;

        foreach ($expired as $booking) {
            // Une transaction par réservation : un départ verrouillé par une
            // autre opération ne doit pas bloquer la libération des autres.
            DB::transaction(function () use ($booking): void {
                $booking->passengers()->update(['holds_seat' => false]);

                $trip = $booking->trip;

                // En mode capacité, le compteur doit reculer d'autant : c'est
                // lui que la contrainte protège, et lui que la vente au guichet
                // consulte.
                if ($trip !== null && $trip->seating_mode === SeatingMode::Capacity) {
                    Trip::query()
                        ->whereKey($trip->id)
                        ->where('seats_taken', '>=', $booking->seats_count)
                        ->decrement('seats_taken', $booking->seats_count);
                }

                $booking->update(['status' => BookingStatus::Expired]);
            });

            $released++;
        }

        return $released;
    }
}
