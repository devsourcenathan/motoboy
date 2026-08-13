<?php

declare(strict_types=1);

namespace App\Modules\Trips\Support;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Trips\Models\Trip;

/**
 * Plan des places d'un départ.
 *
 * Partagé entre le plan public et celui du guichet. Ce n'est pas un instantané
 * mais **une seule règle** : le jour où l'on change ce qui rend une place
 * indisponible, les deux vues doivent changer ensemble — sans quoi l'agent
 * vendrait une place que le passager voit déjà prise (§3 du standard de code).
 *
 * Le guichet en voit une colonne de plus, l'échéance des places tenues : le hold
 * l'emporte sur le comptoir — donner la priorité au guichet obligerait à
 * rembourser un passager venant de payer avec succès — mais l'agent doit
 * distinguer « vendue » de « tenue, se libère dans six minutes » (B2).
 */
final class SeatMap
{
    /**
     * @return array{seating_mode: SeatingMode, capacity: int, seats_available: int, seats: list<array<string, mixed>>}
     */
    public static function of(Trip $trip, bool $withHoldDeadline = false): array
    {
        $held = $trip->getAttributes()['held_seats_count'] ?? null;

        return [
            'seating_mode' => $trip->seating_mode,
            'capacity' => $trip->capacity,
            'seats_available' => is_numeric($held) ? $trip->capacity - (int) $held : $trip->capacity,
            // En mode `CAPACITY`, `seats` est vide et seuls les compteurs sont
            // renseignés : il n'y a pas de plan à afficher, et prétendre le
            // contraire obligerait à inventer des sièges qui n'existent pas.
            'seats' => $trip->seating_mode === SeatingMode::Seated
                ? self::seats($trip, $withHoldDeadline)
                : [],
        ];
    }

    /** @return list<array<string, mixed>> */
    private static function seats(Trip $trip, bool $withHoldDeadline): array
    {
        $vehicle = $trip->vehicle;

        if ($vehicle === null) {
            return [];
        }

        $occupancy = self::occupancy($trip);
        $seats = [];

        foreach ($vehicle->seats()->orderBy('row_index')->orderBy('column_index')->get() as $seat) {
            $state = $occupancy[$seat->id] ?? null;

            $row = [
                'id' => $seat->id,
                'label' => $seat->label,
                'row_index' => $seat->row_index,
                'column_index' => $seat->column_index,
                'status' => match (true) {
                    !$seat->is_bookable => 'UNAVAILABLE',
                    $state !== null => $state['status'],
                    default => 'AVAILABLE',
                },
            ];

            if ($withHoldDeadline) {
                $row['held_until'] = $state['held_until'] ?? null;
            }

            $seats[] = $row;
        }

        return $seats;
    }

    /**
     * Une place **tenue** par un paiement en cours est indisponible au même titre
     * qu'une place vendue, sur tous les canaux — vente au guichet comprise (B2).
     *
     * Le critère est `holds_seat`, et lui seul : c'est ce que lit l'index unique
     * partiel, c'est donc ce qui bloque réellement une seconde vente. Filtrer en
     * plus sur le statut ferait diverger cette liste du compteur
     * `seats_available`, qui compte la même colonne — et montrerait libre un
     * siège que la base refuserait de vendre.
     *
     * @return array<int, array{status: string, held_until: string|null}>
     */
    private static function occupancy(Trip $trip): array
    {
        $occupancy = [];

        $passengers = $trip->passengers()
            ->where('holds_seat', true)
            ->whereNotNull('seat_id')
            ->with('booking')
            ->get();

        foreach ($passengers as $passenger) {
            $booking = $passenger->booking;

            if ($booking !== null && $booking->status === BookingStatus::PendingPayment) {
                $occupancy[(int) $passenger->seat_id] = [
                    'status' => 'HELD',
                    'held_until' => $booking->expires_at?->toIso8601String(),
                ];

                continue;
            }

            // Le défaut est `TAKEN`, jamais « libre » : la place est bloquée par
            // l'index, la montrer disponible produirait un 409 au moment de la
            // vente — avec le passager devant l'agent.
            $occupancy[(int) $passenger->seat_id] = ['status' => 'TAKEN', 'held_until' => null];
        }

        return $occupancy;
    }
}
