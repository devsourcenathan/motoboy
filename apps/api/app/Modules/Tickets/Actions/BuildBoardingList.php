<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Actions;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Tickets\Models\Ticket;
use App\Modules\Trips\Models\Trip;
use Illuminate\Database\Eloquent\Collection;

/**
 * Liste d'embarquement d'un départ.
 *
 * **C'est elle qui fait autorité hors ligne.** L'appareil de l'agent ne vérifie
 * pas la signature du QR — distribuer la clé sur chaque téléphone permettrait à
 * un appareil volé de forger des billets pour toutes les agences. Appartenir à
 * cette liste est donc ce qui fait foi (B3).
 *
 * Elle est aussi le **troisième niveau de secours** : imprimée, elle permet à
 * une agence de continuer quand la caméra, l'écran ou le réseau lâchent. Sans
 * elle, une agence bloquée à la porte de son car un vendredi soir n'utilisera
 * plus jamais le système.
 */
final class BuildBoardingList
{
    /** @return Collection<int, Ticket> */
    public function handle(Trip $trip): Collection
    {
        return Ticket::query()
            ->where('trip_id', $trip->id)
            // Seules les réservations confirmées embarquent : une place tenue
            // n'est pas une place payée, et une réservation annulée ne doit pas
            // apparaître sur la liste que l'agent consulte au portillon.
            ->whereHas('booking', fn ($query) => $query->where('status', BookingStatus::Confirmed))
            ->with([
                'passenger.seat',
                'booking.passengers.ticket.validations',
                'validations',
            ])
            ->get()
            // Trié par place quand il y en a, par nom sinon : c'est l'ordre
            // dans lequel l'agent parcourt le car.
            ->sortBy(static function (Ticket $ticket): string {
                $passenger = $ticket->passenger;

                if ($passenger === null) {
                    return '';
                }

                $seat = $passenger->seat;

                // En mode capacité il n'y a pas de plan de sièges : le nom
                // devient le seul repère de parcours.
                return $seat === null ? $passenger->last_name : $seat->label;
            })
            ->values();
    }
}
