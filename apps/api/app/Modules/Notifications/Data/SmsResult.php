<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

final readonly class SmsResult
{
    private function __construct(
        public bool $delivered,
        public ?string $providerReference,
        public ?string $error,
    ) {}

    public static function sent(?string $providerReference = null): self
    {
        return new self(true, $providerReference, null);
    }

    public static function failed(string $error): self
    {
        return new self(false, null, $error);
    }
}
