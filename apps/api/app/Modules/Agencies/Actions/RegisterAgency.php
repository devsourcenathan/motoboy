<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Actions;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Agencies\Models\AgencyCommercialTerms;
use App\Modules\Identity\Actions\SendOtp;
use App\Modules\Identity\Enums\Locale;
use App\Modules\Identity\Enums\OtpPurpose;
use App\Modules\Identity\Enums\Role;
use App\Modules\Identity\Models\OtpCode;
use App\Modules\Identity\Models\Role as RoleModel;
use App\Modules\Identity\Models\User;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use App\Support\Reference;
use Illuminate\Support\Facades\DB;

/**
 * Inscription d'une agence (§23).
 *
 * Une agence peut s'inscrire elle-même ou être ajoutée par l'administration.
 * Dans les deux cas elle naît **`PENDING`** et ne publie rien : elle doit
 * d'abord fournir ses documents et voir ses coordonnées de reversement
 * vérifiées.
 *
 * Le dirigeant est un utilisateur comme un autre, vérifié par OTP : le compte
 * existe dès cet appel mais reste inutilisable tant que le téléphone n'est pas
 * vérifié (§8).
 *
 * Les conditions commerciales sont créées avec leurs valeurs par défaut. Sans
 * elles, la première réservation lèverait une erreur — une agence approuvée sans
 * conditions est une incohérence de données, pas un cas métier.
 */
final class RegisterAgency
{
    public function __construct(private readonly SendOtp $sendOtp) {}

    public function handle(
        string $name,
        string $phone,
        ?string $legalName,
        ?string $email,
        string $managerFirstName,
        string $managerLastName,
        string $managerPhone,
        Locale $locale,
    ): OtpCode {
        $manager = DB::transaction(function () use (
            $name, $phone, $legalName, $email,
            $managerFirstName, $managerLastName, $managerPhone, $locale,
        ): User {
            $existing = User::query()->where('phone', $managerPhone)->first();

            // Un compte vérifié ne se réécrit pas : ce serait un moyen de
            // détourner le téléphone d'un tiers en créant une agence à son nom.
            if ($existing !== null && $existing->phone_verified_at !== null) {
                throw ApiException::of(
                    ErrorCode::ValidationFailed,
                    'Ce numéro est déjà rattaché à un compte vérifié.',
                );
            }

            $agency = Agency::query()->create([
                'reference' => Reference::generate('AG'),
                'name' => $name,
                'legal_name' => $legalName,
                'phone' => $phone,
                'email' => $email,
                'default_locale' => $locale,
                'status' => 'PENDING',
            ]);

            AgencyCommercialTerms::query()->create(['agency_id' => $agency->id]);

            $manager = $existing ?? new User;

            $manager->fill([
                'phone' => $managerPhone,
                'email' => $email,
                'first_name' => $managerFirstName,
                'last_name' => $managerLastName,
                'locale' => $locale,
            ]);

            $manager->save();

            $this->assignAgencyRole($manager, $agency);

            return $manager;
        });

        return $this->sendOtp->handle($manager->phone, OtpPurpose::Registration, $locale);
    }

    /**
     * Le rôle `AGENCY` est porté **pour une agence donnée** : c'est ce qui rend
     * la portée par agence vérifiable, et sans quoi un compte agence verrait le
     * parc d'un concurrent (B3).
     */
    private function assignAgencyRole(User $user, Agency $agency): void
    {
        $roleId = RoleModel::query()->where('name', Role::Agency->value)->value('id');

        if ($roleId === null) {
            throw new \RuntimeException('Rôle AGENCY absent : le référentiel RBAC n\'est pas seedé.');
        }

        DB::table('role_user')->insert([
            'user_id' => $user->id,
            'role_id' => $roleId,
            'agency_id' => $agency->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
