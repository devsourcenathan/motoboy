<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Requests;

use App\Modules\Payments\Enums\PaymentMethod;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class InitiatePaymentRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            // `CASH` est exclu ici : la vente au guichet est encaissée par
            // l'agence et créée directement en `CONFIRMED` (I2), elle ne passe
            // jamais par ce tunnel.
            'method' => ['required', Rule::in([
                PaymentMethod::MobileMoney->value,
                PaymentMethod::Card->value,
            ])],
            'operator' => ['nullable', 'required_if:method,MOBILE_MONEY', Rule::in(['MTN', 'ORANGE'])],
            'payer_phone' => ['nullable', 'required_if:method,MOBILE_MONEY', 'string', 'max:20'],
        ];
    }

    /**
     * L'en-tête est obligatoire : sur une connexion mobile instable, un client
     * qui rejoue une requête expirée déclencherait un second encaissement.
     */
    public function idempotencyKey(): string
    {
        $key = $this->header('Idempotency-Key');

        if (!is_string($key) || trim($key) === '') {
            throw ApiException::of(
                ErrorCode::ValidationFailed,
                'En-tête Idempotency-Key requise sur l\'initiation de paiement.',
            );
        }

        return trim($key);
    }
}
