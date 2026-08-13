<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Actions;

use App\Modules\Bookings\Models\Booking;
use App\Modules\Bookings\Models\BookingPassenger;
use App\Modules\Tickets\Enums\TicketStatus;
use App\Modules\Tickets\Models\Ticket;
use App\Modules\Tickets\Support\QrPayload;
use App\Support\Reference;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Émet un billet **par passager** (§19 du brief).
 *
 * Le grain du passager n'est pas cosmétique : il permet l'annulation partielle
 * — trois places réservées, une annulée (B5) — et il donne à chaque voyageur un
 * QR qui lui est propre, condition pour que la validation à l'embarquement ait
 * un sens.
 *
 * **Idempotente.** Appelée depuis la confirmation de paiement, donc depuis un
 * webhook rejouable : réémettre ne doit produire ni doublon ni nouvelle
 * référence, un passager pouvant déjà avoir son billet à l'écran.
 */
final class IssueTickets
{
    /** @return Collection<int, Ticket> */
    public function handle(Booking $booking): Collection
    {
        return DB::transaction(function () use ($booking): Collection {
            $existing = Ticket::query()
                ->where('booking_id', $booking->id)
                ->pluck('id', 'booking_passenger_id');

            foreach ($booking->passengers as $passenger) {
                if ($passenger->status !== 'ACTIVE' || $existing->has($passenger->id)) {
                    continue;
                }

                $this->issue($booking, $passenger);
            }

            return Ticket::query()
                ->where('booking_id', $booking->id)
                ->with('passenger.seat')
                ->get();
        });
    }

    private function issue(Booking $booking, BookingPassenger $passenger): void
    {
        $reference = Reference::generate('TKT');

        Ticket::query()->create([
            'reference' => $reference,
            'booking_id' => $booking->id,
            'booking_passenger_id' => $passenger->id,
            'trip_id' => $booking->trip_id,
            // Stockée pour permettre la vérification côté serveur sans
            // recalculer, et pour détecter une clé de signature changée.
            'qr_signature' => QrPayload::sign($reference),
            'status' => TicketStatus::Valid,
            'issued_at' => now(),
        ]);
    }
}
