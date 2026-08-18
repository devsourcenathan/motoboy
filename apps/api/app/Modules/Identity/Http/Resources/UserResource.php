<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Resources;

use App\Modules\Identity\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Conforme au schéma `User` de `docs/openapi.yaml`, qui est normatif.
 *
 * @mixin User
 */
final class UserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'phone' => $this->resource->phone,
            'email' => $this->resource->email,
            'first_name' => $this->resource->first_name,
            'last_name' => $this->resource->last_name,
            'phone_verified' => $this->resource->phone_verified_at !== null,
            'locale' => $this->resource->locale,
            /*
             * Les roles, pour que le client sache quoi afficher. Ils ne protegent
             * rien : chaque endpoint les revalide, et un client modifie ne gagne
             * qu'une page qui echouera.
             *
             * `loadMissing` parce que `shouldBeStrict()` interdit le chargement
             * paresseux, et qu'une ressource ne doit pas dependre de ce que
             * l'appelant a pense a charger.
             */
            'roles' => $this->resource->loadMissing('roles')->roles
                ->pluck('name')
                ->values()
                ->all(),
        ];
    }
}
