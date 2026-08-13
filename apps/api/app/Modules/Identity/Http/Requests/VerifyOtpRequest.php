<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use App\Modules\Identity\Enums\OtpPurpose;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class VerifyOtpRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'phone' => ['required', 'string', 'regex:/^\+[1-9][0-9]{7,14}$/'],
            'code' => ['required', 'string', 'min:4', 'max:8'],
            'purpose' => ['required', Rule::enum(OtpPurpose::class)],
        ];
    }

    public function purpose(): OtpPurpose
    {
        return OtpPurpose::from($this->string('purpose')->toString());
    }
}
