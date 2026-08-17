<?php

declare(strict_types=1);

namespace App\Modules\Rides\Actions;

use App\Modules\Identity\Enums\Role;
use App\Modules\Identity\Models\Role as RoleModel;
use App\Modules\Identity\Models\User;
use App\Modules\Rides\Enums\DriverStatus;
use App\Modules\Rides\Models\DriverProfile;
use Illuminate\Support\Facades\DB;

/**
 * Dépôt — ou nouveau dépôt — d'un dossier chauffeur (E2).
 *
 * **Rejouable après un refus.** Un dossier refusé doit pouvoir être corrigé et
 * représenté : sans cela, un permis mal photographié condamne définitivement le
 * compte, et le chauffeur en ouvre un second avec un autre numéro — ce qui est
 * exactement ce que la validation cherche à empêcher.
 *
 * Le rôle est attribué **au dépôt**, pas à la validation : c'est lui qui décide
 * des onglets affichés, et un dossier en attente doit pouvoir être consulté par
 * celui qui l'a déposé. Le droit de rouler, lui, vient de `canDrive()`.
 */
final class SubmitDriverApplication
{
    /** @param array<string, mixed> $attributes */
    public function handle(User $user, array $attributes): DriverProfile
    {
        return DB::transaction(function () use ($user, $attributes): DriverProfile {
            $profile = DriverProfile::query()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    ...$attributes,
                    /*
                     * Un nouveau dépôt repart de zéro : statut en attente, et
                     * les traces de l'instruction précédente effacées. Laisser
                     * l'ancien motif de refus le ferait réapparaître sur un
                     * dossier corrigé.
                     */
                    'status' => DriverStatus::Pending,
                    'review_note' => null,
                    'reviewed_by' => null,
                    'reviewed_at' => null,
                ],
            );

            $roleId = RoleModel::query()->where('name', Role::Driver->value)->value('id');

            if ($roleId !== null) {
                // `role_user` porte aussi les rôles rattachés à une agence :
                // celui-ci ne l'est pas, d'où l'absence d'`agency_id`.
                DB::table('role_user')->insertOrIgnore([
                    'user_id' => $user->id,
                    'role_id' => $roleId,
                ]);
            }

            return $profile;
        });
    }
}
