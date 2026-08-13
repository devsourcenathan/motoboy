<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Modules\Notifications\Contracts\SmsSender;
use App\Modules\Notifications\Data\SmsMessage;
use App\Modules\Notifications\Data\SmsResult;

/**
 * Capture les envois au lieu de les journaliser.
 *
 * C'est le seul moyen de lire le code envoyé : il est haché en base et ne doit
 * jamais apparaître dans le journal des notifications. Le port existe
 * précisément pour rendre ce genre de substitution triviale (§7 du brief).
 */
final class FakeSmsSender implements SmsSender
{
    /** @var list<SmsMessage> */
    private array $messages = [];

    public function send(SmsMessage $message): SmsResult
    {
        $this->messages[] = $message;

        return SmsResult::sent('test-'.count($this->messages));
    }

    /** @return list<SmsMessage> */
    public function all(): array
    {
        return $this->messages;
    }

    public function count(): int
    {
        return count($this->messages);
    }

    public function at(int $index): SmsMessage
    {
        return $this->messages[$index]
            ?? throw new \RuntimeException("Aucun SMS envoyé à l'indice {$index}.");
    }

    public function last(): SmsMessage
    {
        return $this->at(count($this->messages) - 1);
    }

    public function forget(): void
    {
        $this->messages = [];
    }
}
