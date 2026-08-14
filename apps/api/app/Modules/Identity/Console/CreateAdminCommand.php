<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console;

use App\Modules\Identity\Enums\Locale;
use App\Modules\Identity\Enums\Role;
use App\Modules\Identity\Models\Role as RoleModel;
use App\Modules\Identity\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Crée un compte d'administration.
 *
 * **Une commande, pas un endpoint.** Une route qui fabrique un super
 * administrateur est une porte ouverte tant qu'elle existe : elle ne peut être
 * protégée que par un secret, qui finit dans un dépôt ou un historique de
 * commandes. Une commande console n'est atteignable que par quelqu'un qui a déjà
 * accès au serveur.
 *
 * Le compte est créé **déjà vérifié** : l'OTP prouve la possession d'un
 * téléphone, ce qui n'a pas de sens pour un compte qu'un opérateur crée sur la
 * machine. Il se connecte ensuite normalement, par OTP.
 */
final class CreateAdminCommand extends Command
{
    protected $signature = 'motoboy:create-admin
        {phone : Numéro au format international, +237…}
        {--first-name=Admin}
        {--last-name=MOTOBOY}
        {--email=}
        {--super : Rôle SUPER_ADMIN — configuration de la plateforme et audit (I4)}';

    protected $description = 'Crée un compte d\'administration et lui attribue son rôle.';

    public function handle(): int
    {
        $phone = $this->argument('phone');
        $phone = is_string($phone) ? trim($phone) : '';

        if (!str_starts_with($phone, '+')) {
            $this->error('Le numéro doit être au format international, par exemple +237690000000.');

            return self::FAILURE;
        }

        $role = $this->option('super') ? Role::SuperAdmin : Role::Admin;
        $roleId = RoleModel::query()->where('name', $role->value)->value('id');

        if ($roleId === null) {
            $this->error("Rôle {$role->value} absent. Lancer `php artisan db:seed` d'abord.");

            return self::FAILURE;
        }

        $user = DB::transaction(function () use ($phone, $roleId): User {
            $user = User::query()->firstOrNew(['phone' => $phone]);

            $user->fill([
                'first_name' => $this->text('first-name', 'Admin'),
                'last_name' => $this->text('last-name', 'MOTOBOY'),
                'email' => $this->text('email') ?: null,
                'locale' => Locale::French,
            ]);

            // Vérifié d'office : l'OTP atteste la possession d'un téléphone, ce
            // qu'un opérateur créant le compte sur la machine a déjà démontré
            // autrement.
            $user->forceFill(['phone_verified_at' => now(), 'is_active' => true])->save();

            $already = DB::table('role_user')
                ->where('user_id', $user->id)
                ->where('role_id', $roleId)
                ->whereNull('agency_id')
                ->exists();

            if (!$already) {
                DB::table('role_user')->insert([
                    'user_id' => $user->id,
                    // Rôle **global** : un administrateur n'est rattaché à
                    // aucune agence, contrairement au personnel d'agence dont
                    // les droits valent pour une agence donnée (B3).
                    'agency_id' => null,
                    'role_id' => $roleId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return $user;
        });

        $this->info("Compte {$role->value} prêt : {$user->fullName()} — {$user->phone}");
        $this->line('Connexion par OTP : POST /v1/auth/login puis /v1/auth/otp/verify.');

        return self::SUCCESS;
    }

    /**
     * Une option de console vaut `array|bool|string|null` : la ramener à une
     * chaîne ici plutôt que de la forcer à l'appel, où l'on cesserait de voir
     * qu'elle pouvait être autre chose.
     */
    private function text(string $key, string $default = ''): string
    {
        $value = $this->option($key);

        return is_string($value) ? $value : $default;
    }
}
