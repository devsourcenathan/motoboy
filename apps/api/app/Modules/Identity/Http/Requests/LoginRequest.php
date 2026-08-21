<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use App\Modules\Identity\Rules\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;

final class LoginRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'phone' => PhoneNumber::rules(),
        ];
    }
}
