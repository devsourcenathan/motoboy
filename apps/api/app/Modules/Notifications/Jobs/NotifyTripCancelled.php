<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Jobs;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Identity\Enums\Locale;
use App\Modules\Notifications\Contracts\SmsSender;
use App\Modules\Notifications\Data\SmsMessage;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Trips\Models\Trip;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Prévient les passagers d'un départ annulé.
 *
 * **En file, pas en synchrone.** L'annulation touche plusieurs dizaines de
 * passagers ; envoyer autant de SMS dans la requête de l'agent la ferait expirer
 * au pire moment — celui où l'agence a le plus besoin que l'annulation aboutisse.
 *
 * C'est le cas où le coût du SMS est **justifié sans discussion** (I8) : un
 * passager qui se déplace vers une gare pour un car annulé est perdu
 * définitivement, quel qu'ait été le prix du message.
 */
final class NotifyTripCancelled implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(private readonly int $tripId) {}

    public function handle(SmsSender $sms): void
    {
        $trip = Trip::query()->whereKey($this->tripId)->with('agency')->first();

        if ($trip === null) {
            return;
        }

        $bookings = Booking::query()
            ->where('trip_id', $trip->id)
            ->where('status', BookingStatus::CancelledByAgency)
            ->with('user')
            ->get();

        foreach ($bookings as $booking) {
            $this->notify($sms, $trip, $booking);
        }
    }

    private function notify(SmsSender $sms, Trip $trip, Booking $booking): void
    {
        $user = $booking->user;

        // Deux cas, et deux seulement : un passager avec un compte, ou un
        // passager de vente au comptoir qui n'en a pas et pour qui le téléphone
        // de contact et la langue de l'agence font foi (I2, I10).
        if ($user !== null) {
            $phone = $user->phone;
            $locale = $user->locale;
        } else {
            $phone = $booking->contact_phone;
            $locale = $trip->agency->default_locale ?? Locale::French;
        }

        if ($phone === null || trim($phone) === '') {
            return;
        }

        $body = trans('sms.trip_cancelled', [
            'reference' => $booking->reference,
            // Sans « à » : le SMS reste en GSM-7, donc sur un seul segment.
            'date' => $trip->departure_at?->setTimezone(config('app.display_timezone'))->format('d/m H\hi') ?? '',
        ], $locale->value);

        $result = $sms->send(new SmsMessage(
            to: $phone,
            body: is_string($body) ? $body : '',
            locale: $locale,
            type: 'TRIP_CANCELLED',
        ));

        Notification::query()->create([
            'user_id' => $booking->user_id,
            'phone' => $phone,
            'channel' => 'SMS',
            'locale' => $locale,
            'type' => 'TRIP_CANCELLED',
            'payload' => ['booking_reference' => $booking->reference, 'trip_reference' => $trip->reference],
            'status' => $result->delivered ? 'SENT' : 'FAILED',
            'provider_reference' => $result->providerReference,
            'sent_at' => $result->delivered ? now() : null,
            'error' => $result->error,
        ]);
    }
}
