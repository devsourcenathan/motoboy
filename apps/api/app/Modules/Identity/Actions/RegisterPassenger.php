<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\Locale;
use App\Modules\Identity\Enums\OtpPurpose;
use App\Modules\Identity\Enums\Role;
use App\Modules\Identity\Models\OtpCode;
use App\Modules\Identity\Models\Role as RoleModel;
use App\Modules\Identity\Models\User;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Support\Facades\DB;

/**
 * Inscrit un passager et lui envoie un code de vérification.
 *
 * Le compte existe dès cet appel mais reste **inutilisable tant que le
 * téléphone n'est pas vérifié** (§8) : c'est l'OTP qui fait foi, pas la
 * création de la ligne.
 */
final class RegisterPassenger
{
    public function __construct(private readonly SendOtp $sendOtp) {}

    public function handle(
        string $phone,
        string $firstName,
        string $lastName,
        ?string $email,
        Locale $locale,
    ): OtpCode {
        $user = DB::transaction(function () use ($phone, $firstName, $lastName, $email, $locale): User {
            $existing = User::query()->where('phone', $phone)->first();

            if ($existing !== null && $existing->phone_verified_at !== null) {
                throw ApiException::of(
                    ErrorCode::ValidationFailed,
                    'Ce numéro est déjà inscrit et vérifié.',
                );
            }

            /*
             * Une inscription non vérifiée est réécrite plutôt que refusée.
             *
             * Sans cela, saisir le numéro de quelqu'un d'autre le bloquerait
             * définitivement — un vecteur de squattage trivial. Le risque
             * inverse, écraser un nom en attente, est négligeable : c'est l'OTP
             * qui garde la porte, et il part sur le téléphone du titulaire.
             */
            $user = $existing ?? new User;

            $user->fill([
                'phone' => $phone,
                'email' => $email,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'locale' => $locale,
            ]);

            $user->save();

            $this->assignPassengerRole($user);

            return $user;
        });

        return $this->sendOtp->handle($user->phone, OtpPurpose::Registration, $locale);
    }

    /**
     * Vérification puis insertion, jamais `upsert` : l'unicité de `role_user`
     * est portée par des index **partiels**, dont PostgreSQL n'infère pas de
     * `ON CONFLICT` sans que le prédicat soit répété.
     */
    private function assignPassengerRole(User $user): void
    {
        $roleId = RoleModel::query()->where('name', Role::Passenger->value)->value('id');

        if ($roleId === null) {
            return;
        }

        $already = DB::table('role_user')
            ->where('user_id', $user->id)
            ->where('role_id', $roleId)
            ->whereNull('agency_id')
            ->exists();

        if (!$already) {
            DB::table('role_user')->insert([
                'user_id' => $user->id,
                'role_id' => $roleId,
                'agency_id' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
