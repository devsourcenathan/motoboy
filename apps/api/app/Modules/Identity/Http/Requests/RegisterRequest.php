<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use App\Modules\Identity\Enums\Locale;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class RegisterRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            // E.164 : le téléphone est l'identifiant réel du passager (§8), il
            // doit donc être stocké sous une forme unique et comparable.
            'phone' => ['required', 'string', 'regex:/^\+[1-9][0-9]{7,14}$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'locale' => ['nullable', Rule::enum(Locale::class)],
        ];
    }

    /** La langue choisie ici détermine celle de l'OTP — le tout premier message reçu (I10). */
    public function locale(): Locale
    {
        $locale = $this->input('locale');

        return is_string($locale) ? Locale::from($locale) : Locale::French;
    }
}
