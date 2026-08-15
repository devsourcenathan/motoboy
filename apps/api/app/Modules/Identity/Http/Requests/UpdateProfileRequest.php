<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use App\Modules\Identity\Enums\Locale;
use App\Modules\Identity\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Modification de son propre profil.
 *
 * **Le téléphone n'y figure pas.** Il porte l'identité du compte *et* la
 * destination des SMS : le changer sans prouver qu'on possède le nouveau numéro
 * permettrait de déplacer un compte vers un téléphone qu'on ne détient pas, et
 * enverrait billets et codes à un inconnu. Un changement de numéro demande son
 * propre parcours, avec vérification par OTP des deux côtés — ce n'est pas une
 * ligne de formulaire.
 *
 * **Tous les champs sont facultatifs**, et seuls ceux transmis sont modifiés :
 * un écran qui ne règle que la langue ne doit pas avoir à renvoyer le nom, au
 * risque de l'écraser avec une valeur périmée qu'il traînait en mémoire.
 */
final class UpdateProfileRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var User $user */
        $user = $this->user();

        return [
            'first_name' => ['sometimes', 'string', 'min:1', 'max:100'],
            'last_name' => ['sometimes', 'string', 'min:1', 'max:100'],

            // `nullable` : effacer son adresse est un choix légitime, elle n'a
            // jamais été obligatoire. L'unicité s'ignore elle-même, sans quoi
            // renvoyer sa propre adresse serait refusé.
            'email' => [
                'sometimes',
                'nullable',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],

            'locale' => ['sometimes', Rule::enum(Locale::class)],
        ];
    }
}
