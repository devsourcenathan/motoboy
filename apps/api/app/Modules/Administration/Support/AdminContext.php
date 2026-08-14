<?php

declare(strict_types=1);

namespace App\Modules\Administration\Support;

use App\Modules\Identity\Models\User;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\Request;

/**
 * Autorisation de l'espace d'administration.
 *
 * **Permission globale, pas portée par agence.** Un administrateur n'est
 * rattaché à aucune agence, contrairement au personnel d'agence dont les droits
 * valent pour une agence donnée (B3). Le partage entre `ADMIN` et `SUPER_ADMIN`
 * passe uniquement par les permissions du RBAC : il se recalibre sans refonte si
 * l'usage montre qu'il est mal placé (I4).
 */
final class AdminContext
{
    public function require(Request $request, string $permission): User
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session requise.');
        }

        if (!$user->hasGlobalPermission($permission)) {
            throw ApiException::of(
                ErrorCode::Forbidden,
                'Permission insuffisante.',
                ['permission' => $permission],
            );
        }

        return $user;
    }
}
