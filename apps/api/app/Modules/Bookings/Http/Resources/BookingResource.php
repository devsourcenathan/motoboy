<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Resources;

use App\Modules\Bookings\Models\Booking;
use App\Modules\Trips\Http\Resources\TripSummaryResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Conforme au schéma `Booking` de `docs/openapi.yaml`, qui est normatif.
 *
 * @mixin Booking
 */
final class BookingResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $booking = $this->resource;
        $trip = $booking->trip;

        return [
            'reference' => $booking->reference,
            'status' => $booking->status,

            // Le client en tire un compte à rebours : le passager doit savoir
            // qu'il est chronométré (B2). L'expiration fait foi côté serveur —
            // un compte à rebours qui atteint zéro invite à redemander l'état,
            // il ne conclut rien.
            'expires_at' => $booking->expires_at?->toIso8601String(),

            'trip' => $trip === null ? null : (new TripSummaryResource($trip))->resolve(),
            'passengers' => $this->passengers(),
            'seats_count' => $booking->seats_count,
            'total' => ['amount' => $booking->total_amount, 'currency' => $booking->currency],

            // Conditions **figées** sur la réservation, pas celles courantes de
            // l'agence : un durcissement ultérieur est sans effet ici (B5).
            'cancellation_policy' => [
                'deadline_hours' => $booking->cancellation_deadline_hours,
                'fee_type' => $booking->cancellation_fee_type,
                'fee_value' => $booking->cancellation_fee_value,
            ],

            'contact_name' => $booking->contact_name,
            'contact_phone' => $booking->contact_phone,
            'created_at' => $booking->created_at?->toIso8601String(),
            'confirmed_at' => $booking->confirmed_at?->toIso8601String(),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function passengers(): array
    {
        $passengers = [];

        foreach ($this->resource->passengers as $passenger) {
            $passengers[] = [
                'id' => $passenger->id,
                'first_name' => $passenger->first_name,
                'last_name' => $passenger->last_name,
                'phone' => $passenger->phone,
                'seat_label' => $passenger->seat?->label,
                'status' => $passenger->status,
                'ticket_reference' => $passenger->ticket?->reference,
            ];
        }

        return $passengers;
    }
}
