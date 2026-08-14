<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Requests;

use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Data\NewPassenger;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Foundation\Http\FormRequest;

final class CreateBookingRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'trip_reference' => ['required', 'string', 'max:20'],
            'passengers' => ['required', 'array', 'min:1', 'max:20'],
            'passengers.*.first_name' => ['required', 'string', 'max:100'],
            'passengers.*.last_name' => ['required', 'string', 'max:100'],
            'passengers.*.phone' => ['nullable', 'string', 'max:20'],
            'passengers.*.seat_id' => ['nullable', 'integer'],
            'contact_name' => ['nullable', 'string', 'max:150'],
            'contact_phone' => ['nullable', 'string', 'max:20'],
        ];
    }

    public function newBooking(): NewBooking
    {
        // La validation a déjà tourné, mais l'entrée reste de la donnée HTTP :
        // on la narre explicitement plutôt que d'en décrire la forme dans un
        // docblock, qui serait une promesse que rien ne tient à l'exécution.
        $rows = $this->input('passengers');
        $passengers = [];

        foreach (is_array($rows) ? $rows : [] as $row) {
            if (!is_array($row)) {
                continue;
            }

            $phone = $row['phone'] ?? null;
            $seatId = $row['seat_id'] ?? null;

            $passengers[] = new NewPassenger(
                firstName: (string) ($row['first_name'] ?? ''),
                lastName: (string) ($row['last_name'] ?? ''),
                phone: is_string($phone) && $phone !== '' ? $phone : null,
                seatId: is_numeric($seatId) ? (int) $seatId : null,
            );
        }

        $userId = $this->user()?->getAuthIdentifier();

        return new NewBooking(
            tripReference: $this->string('trip_reference')->toString(),
            passengers: $passengers,
            idempotencyKey: $this->idempotencyKey(),
            userId: is_numeric($userId) ? (int) $userId : null,
            contactName: $this->filled('contact_name') ? $this->string('contact_name')->toString() : null,
            contactPhone: $this->filled('contact_phone') ? $this->string('contact_phone')->toString() : null,
        );
    }

    /**
     * L'en-tête est **obligatoire**.
     *
     * Sans elle, une requête qui expire côté réseau mais aboutit côté serveur
     * — banal sur une connexion mobile — pousse le client à réessayer, et le
     * passager se retrouve avec deux réservations et deux places immobilisées.
     */
    private function idempotencyKey(): string
    {
        $key = $this->header('Idempotency-Key');

        if (!is_string($key) || trim($key) === '') {
            throw ApiException::of(
                ErrorCode::ValidationFailed,
                'En-tête Idempotency-Key requise sur la création de réservation.',
            );
        }

        return trim($key);
    }
}
