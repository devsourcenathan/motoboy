<?php

declare(strict_types=1);

namespace App\Support\Http;

use RuntimeException;

/**
 * Échec métier destiné au client, porteur d'un code du contrat.
 *
 * Le message reste un diagnostic : il part dans les journaux, jamais à
 * l'écran. `details` porte les valeurs d'interpolation dont le client a besoin
 * pour composer son propre texte — échéance dépassée, sièges en conflit.
 */
final class ApiException extends RuntimeException
{
    /** @param array<string, mixed> $details */
    public function __construct(
        public readonly ErrorCode $errorCode,
        string $message,
        public readonly array $details = [],
    ) {
        parent::__construct($message, $errorCode->status());
    }

    /** @param array<string, mixed> $details */
    public static function of(ErrorCode $code, string $message, array $details = []): self
    {
        return new self($code, $message, $details);
    }
}
