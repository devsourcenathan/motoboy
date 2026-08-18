<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Support;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Identity\Enums\Role;
use App\Modules\Identity\Models\User;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\Request;

/**
 * Résout l'agence pour laquelle l'utilisateur agit.
 *
 * **Toute écriture du back-office passe par ici.** La portée par agence n'est
 * pas une commodité : sans elle, une agence modifierait les véhicules, les
 * horaires et les tarifs d'une autre. C'est la même exigence que pour
 * l'embarquement (B3), appliquée au reste de l'espace agence.
 */
final class AgencyContext
{
    /**
     * L'agence de l'utilisateur, ou un refus explicite.
     *
     * Un utilisateur portant le rôle `AGENCY` pour plusieurs agences est refusé
     * plutôt que traité au hasard : deviner laquelle laisserait publier des
     * départs sous une raison sociale qui n'est pas la bonne. Le jour où ce cas
     * existera, il faudra un sélecteur explicite — pas une heuristique.
     */
    /**
     * L'agence du compte courant.
     *
     * **Le personnel entre par la permission, jamais par le role seul.**
     *
     * Cette methode n'acceptait que le role `AGENCY`. Consequence : un compte
     * `AGENT` — cree precisement pour l'embarquement — ne pouvait atteindre aucun
     * endpoint d'agence, y compris la liste d'embarquement dont la PWA a besoin.
     * Le role existait, ses permissions etaient seedees, et rien ne le laissait
     * entrer.
     *
     * Elargir l'acces a tous les roles d'agence aurait ouvert l'inventaire et les
     * reversements au premier guichetier venu, puisque la plupart des endpoints
     * ne verifient rien d'autre. D'ou la forme retenue :
     *
     * - **sans permission nommee**, il faut le role `AGENCY` — le comportement
     *   d'origine, donc rien ne s'ouvre par inadvertance ;
     * - **avec une permission**, tout role rattache a l'agence est accepte, a
     *   condition de la porter.
     *
     * Chaque endpoint que le personnel doit atteindre declare donc ce qu'il exige,
     * et le silence reste fermé.
     */
    public function require(Request $request, ?string $permission = null): Agency
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session requise.');
        }

        $agencyIds = $user->roles()
            ->when(
                $permission === null,
                fn ($query) => $query->where('roles.name', Role::Agency->value),
            )
            ->pluck('role_user.agency_id')
            ->filter()
            ->unique()
            ->values();

        if ($agencyIds->count() === 0) {
            throw ApiException::of(ErrorCode::Forbidden, 'Vous n\'administrez aucune agence.');
        }

        if ($agencyIds->count() > 1) {
            throw ApiException::of(
                ErrorCode::Forbidden,
                'Compte rattaché à plusieurs agences : sélection explicite requise.',
            );
        }

        $agency = Agency::query()->whereKey($agencyIds->first())->first();

        if ($agency === null) {
            throw ApiException::of(ErrorCode::Forbidden, 'Agence introuvable.');
        }

        /*
         * La permission se verifie **pour cette agence** : un guichetier d'une
         * agence n'est rien chez une autre, et le RBAC porte la portee sur le
         * pivot.
         */
        if ($permission !== null && !$user->hasPermissionForAgency($permission, $agency->id)) {
            throw ApiException::of(ErrorCode::Forbidden, 'Permission insuffisante.');
        }

        // Une agence non validée ne publie rien : elle doit d'abord fournir ses
        // documents et être approuvée (§23 du brief).
        if ($agency->status !== 'APPROVED') {
            throw ApiException::of(
                ErrorCode::Forbidden,
                'Agence non validée : publication impossible.',
                ['status' => $agency->status],
            );
        }

        return $agency;
    }

    /**
     * Vérifie qu'une ressource appartient bien à l'agence.
     *
     * Renvoie `NOT_FOUND` et non `FORBIDDEN` : répondre « interdit » sur la
     * ressource d'une autre agence confirmerait son existence, et permettrait
     * d'énumérer le parc d'un concurrent.
     */
    public function own(Agency $agency, ?int $ownerId): void
    {
        if ($ownerId !== $agency->id) {
            throw ApiException::of(ErrorCode::NotFound, 'Ressource introuvable.');
        }
    }
}
