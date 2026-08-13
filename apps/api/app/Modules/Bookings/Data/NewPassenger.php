<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Data;

final readonly class NewPassenger
{
    public function __construct(
        public string $firstName,
        public string $lastName,
        public ?string $phone = null,
        /** Requis en mode `SEATED`, ignoré en mode `CAPACITY`. */
        public ?int $seatId = null,
    ) {}
}
