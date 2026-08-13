<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Data;

/**
 * Demande de réservation, validée en amont.
 *
 * L'Action reçoit un objet typé et reste testable sans couche web : la
 * validation vit dans une `FormRequest` (§4 du standard de code).
 */
final readonly class NewBooking
{
    /** @param list<NewPassenger> $passengers */
    public function __construct(
        public string $tripReference,
        public array $passengers,
        public string $idempotencyKey,
        public ?int $userId = null,
        public ?string $contactName = null,
        public ?string $contactPhone = null,
    ) {}

    public function seatCount(): int
    {
        return count($this->passengers);
    }

    /** @return list<int> */
    public function seatIds(): array
    {
        $ids = [];

        foreach ($this->passengers as $passenger) {
            if ($passenger->seatId !== null) {
                $ids[] = $passenger->seatId;
            }
        }

        return $ids;
    }
}
