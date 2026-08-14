<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Http\Requests;

use App\Modules\Tickets\Data\QueuedValidation;
use App\Modules\Tickets\Enums\ValidationMethod;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SyncValidationsRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'device_id' => ['nullable', 'string', 'max:100'],
            // Bornée : une file locale plus longue signale un appareil resté
            // des jours hors ligne, cas qu'il vaut mieux découper que subir.
            'validations' => ['required', 'array', 'min:1', 'max:200'],
            'validations.*.client_id' => ['required', 'string', 'max:100'],
            'validations.*.ticket_reference' => ['required', 'string', 'max:30'],
            'validations.*.validated_at' => ['required', 'date'],
            'validations.*.method' => ['required', Rule::enum(ValidationMethod::class)],
        ];
    }

    /** @return list<QueuedValidation> */
    public function queued(): array
    {
        $rows = $this->input('validations');
        $queued = [];

        foreach (is_array($rows) ? $rows : [] as $row) {
            if (!is_array($row)) {
                continue;
            }

            $method = ValidationMethod::tryFrom((string) ($row['method'] ?? ''));

            if ($method === null) {
                continue;
            }

            $queued[] = new QueuedValidation(
                clientId: (string) ($row['client_id'] ?? ''),
                ticketReference: (string) ($row['ticket_reference'] ?? ''),
                // Horodatage de l'appareil : l'agent peut être hors ligne, et
                // l'heure du serveur ne dirait pas quand le passager est monté.
                validatedAt: CarbonImmutable::parse((string) ($row['validated_at'] ?? 'now')),
                method: $method,
            );
        }

        return $queued;
    }
}
