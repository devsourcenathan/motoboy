<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Data;

use App\Support\Http\ErrorCode;
use Carbon\CarbonInterface;

/**
 * Résultat d'une validation, **élément par élément**.
 *
 * La synchronisation n'est délibérément pas du tout-ou-rien : un doublon ne doit
 * pas faire échouer les quarante autres validations du même car (B3).
 */
final readonly class ValidationOutcome
{
    private function __construct(
        public string $clientId,
        public string $ticketReference,
        public string $status,
        public ?ErrorCode $code = null,
        public ?CarbonInterface $firstValidatedAt = null,
    ) {}

    public static function accepted(string $clientId, string $reference): self
    {
        return new self($clientId, $reference, 'ACCEPTED');
    }

    /**
     * Deux agents ont scanné le même billet. C'est une **anomalie à remonter**,
     * pas une fraude à bloquer : les deux relèvent de la même agence, et rejeter
     * ferait perdre l'information qui permet de diagnostiquer.
     */
    public static function duplicate(string $clientId, string $reference, ?CarbonInterface $first): self
    {
        return new self($clientId, $reference, 'DUPLICATE', ErrorCode::TicketAlreadyValidated, $first);
    }

    public static function rejected(string $clientId, string $reference, ErrorCode $code): self
    {
        return new self($clientId, $reference, 'REJECTED', $code);
    }
}
