<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Http\Resources;

use App\Modules\Tickets\Models\Ticket;
use App\Modules\Tickets\Support\QrPayload;
use App\Modules\Trips\Http\Resources\TripSummaryResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Conforme au schéma `Ticket` de `docs/openapi.yaml`, qui est normatif.
 *
 * @mixin Ticket
 */
final class TicketResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $ticket = $this->resource;
        $passenger = $ticket->passenger;
        $trip = $ticket->trip;

        return [
            'reference' => $ticket->reference,
            'status' => $ticket->status,
            'booking_reference' => $ticket->booking?->reference,
            'passenger_name' => $passenger?->fullName(),
            'seat_label' => $passenger?->seat?->label,
            'trip' => $trip === null ? null : (new TripSummaryResource($trip))->resolve(),

            /*
             * Le contenu à encoder, pas une image.
             *
             * Le client **regénère le QR localement** à partir de cette chaîne :
             * un billet dont le QR ne s'affiche pas en gare ne vaut rien, et
             * télécharger une image le rendrait dépendant du réseau au moment
             * précis où il n'y en a pas (I5).
             */
            'qr_payload' => QrPayload::encode($ticket->reference),

            'issued_at' => $ticket->issued_at?->toIso8601String(),
        ];
    }
}
