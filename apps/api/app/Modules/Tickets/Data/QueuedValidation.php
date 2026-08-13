<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Data;

use App\Modules\Tickets\Enums\ValidationMethod;
use Carbon\CarbonImmutable;

final readonly class QueuedValidation
{
    public function __construct(
        /**
         * Identifiant local à l'appareil.
         *
         * Il permet au client de corréler les résultats et de purger sa file, et
         * il distingue un renvoi d'une vraie double validation.
         */
        public string $clientId,
        public string $ticketReference,
        /**
         * Horodatage de l'appareil : l'agent peut être hors ligne, et l'heure du
         * serveur ne dirait pas quand le passager est monté.
         */
        public CarbonImmutable $validatedAt,
        public ValidationMethod $method,
    ) {}
}
