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
     *
     * ---
     *
     * **Cette méthode ne vérifie pas l'admission, et c'est délibéré.**
     *
     * Elle le faisait, pour tous les endpoints d'agence sans distinction. Une
     * agence fraîchement inscrite naît `PENDING` : elle recevait donc un 403 sur
     * la totalité de son espace, y compris le dépôt de ses pièces — dont
     * l'admission dépend. Le circuit se refermait sur lui-même, et aucune agence
     * ne pouvait être admise autrement qu'en aveugle.
     *
     * L'intention derrière cette garde était de **ne rien publier** ; sa
     * formulation interdisait aussi de se préparer. Les deux sont maintenant
     * distincts : `requireApproved()` garde la publication et la vente, et la
     * garantie côté public ne repose plus sur elle seule — `Trip::openForOnlineSale`
     * écarte désormais les agences non admises, quelle que soit la façon dont le
     * départ a été créé.
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

        /*
         * **Une agence rejetée n'a plus rien à préparer.** `ReviewAgency` ne
         * transite que depuis `PENDING` : le refus est terminal, et laisser
         * l'espace ouvert ferait déposer des pièces que personne n'instruira.
         *
         * `PENDING`, en revanche, passe — voir le docbloc de cette méthode.
         */
        if ($agency->status === 'REJECTED') {
            throw ApiException::of(
                ErrorCode::Forbidden,
                'Candidature refusée.',
                ['status' => $agency->status],
            );
        }

        return $agency;
    }

    /**
     * L'agence, **et** son admission.
     *
     * Réservée à ce qui expose l'agence au public ou fait circuler de l'argent :
     * générer des départs, vendre au guichet, embarquer, annuler. Tout le reste
     * — pièces, gares, parc, personnel, coordonnées de reversement — relève de
     * la préparation et passe par `require()`.
     */
    public function requireApproved(Request $request, ?string $permission = null): Agency
    {
        $agency = $this->require($request, $permission);

        if ($agency->status !== 'APPROVED') {
            throw ApiException::of(
                ErrorCode::AgencyNotApproved,
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
