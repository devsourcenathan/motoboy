<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Actions;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Identity\Models\User;
use App\Modules\Tickets\Data\QueuedValidation;
use App\Modules\Tickets\Data\ValidationOutcome;
use App\Modules\Tickets\Enums\TicketStatus;
use App\Modules\Tickets\Models\Ticket;
use App\Modules\Tickets\Models\TicketValidation;
use App\Modules\Trips\Models\Trip;
use App\Support\Http\ErrorCode;
use Illuminate\Support\Facades\DB;

/**
 * Applique les validations mises en file hors ligne.
 *
 * **Chaque élément a son sort.** Un doublon ne doit pas faire échouer les
 * quarante autres validations du même car : la réponse est un `200` portant un
 * résultat par élément, jamais un rejet global (B3).
 */
final class SyncTicketValidations
{
    /**
     * @param  list<QueuedValidation>  $queued
     * @return list<ValidationOutcome>
     */
    public function handle(Trip $trip, User $agent, ?string $deviceId, array $queued): array
    {
        $outcomes = [];

        foreach ($queued as $item) {
            $outcomes[] = $this->apply($trip, $agent, $deviceId, $item);
        }

        return $outcomes;
    }

    private function apply(
        Trip $trip,
        User $agent,
        ?string $deviceId,
        QueuedValidation $item,
    ): ValidationOutcome {
        /*
         * Renvoi du même geste, et non double validation.
         *
         * Un appareil qui synchronise, perd la réponse et resynchronise réémet
         * les mêmes identifiants locaux. Le traiter comme un doublon
         * fabriquerait une fausse anomalie à chaque coupure réseau — et la
         * statistique censée révéler un vrai problème d'exploitation deviendrait
         * du bruit.
         */
        if ($deviceId !== null) {
            $already = TicketValidation::query()
                ->where('device_id', $deviceId)
                ->where('client_id', $item->clientId)
                ->first();

            if ($already !== null) {
                return $already->is_duplicate
                    ? ValidationOutcome::duplicate($item->clientId, $item->ticketReference, $already->validated_at)
                    : ValidationOutcome::accepted($item->clientId, $item->ticketReference);
            }
        }

        $ticket = Ticket::query()
            ->where('reference', $item->ticketReference)
            ->with('booking', 'validations')
            ->first();

        if ($ticket === null) {
            return ValidationOutcome::rejected($item->clientId, $item->ticketReference, ErrorCode::TicketNotFound);
        }

        // Le cas le plus fréquent au portillon : un passager qui s'est trompé
        // d'heure ou de car. L'agent doit le savoir, pas lire « invalide ».
        if ($ticket->trip_id !== $trip->id) {
            return ValidationOutcome::rejected($item->clientId, $item->ticketReference, ErrorCode::TicketWrongTrip);
        }

        if ($ticket->status === TicketStatus::Cancelled
            || $ticket->booking?->status?->isCancelled() === true) {
            return ValidationOutcome::rejected($item->clientId, $item->ticketReference, ErrorCode::TicketCancelled);
        }

        $first = $ticket->validations->firstWhere('is_duplicate', false);

        return DB::transaction(function () use ($ticket, $agent, $deviceId, $item, $first): ValidationOutcome {
            TicketValidation::query()->create([
                'ticket_id' => $ticket->id,
                'trip_id' => $ticket->trip_id,
                'validated_by' => $agent->id,
                'validated_at' => $item->validatedAt,
                'method' => $item->method,
                'device_id' => $deviceId,
                'client_id' => $item->clientId,
                'synced_at' => now(),
                'is_duplicate' => $first !== null,
            ]);

            if ($first !== null) {
                return ValidationOutcome::duplicate(
                    $item->clientId,
                    $item->ticketReference,
                    $first->validated_at,
                );
            }

            $ticket->update(['status' => TicketStatus::Used]);
            $this->closeBookingIfFullyBoarded($ticket);

            return ValidationOutcome::accepted($item->clientId, $item->ticketReference);
        });
    }

    /**
     * Une réservation passe en `USED` quand **tous** ses passagers actifs ont
     * embarqué.
     *
     * Un groupe dont deux voyageurs sur trois sont montés n'a pas voyagé : le
     * marquer comme tel masquerait le passager resté à quai, alors que c'est
     * précisément ce que l'agence doit voir.
     */
    private function closeBookingIfFullyBoarded(Ticket $ticket): void
    {
        $booking = $ticket->booking;

        if ($booking === null) {
            return;
        }

        $active = $booking->passengers()->where('status', 'ACTIVE')->count();

        $boarded = Ticket::query()
            ->where('booking_id', $booking->id)
            ->where('status', TicketStatus::Used)
            ->count();

        if ($active > 0 && $boarded >= $active) {
            $booking->update(['status' => BookingStatus::Used]);
        }
    }
}
