<?php

declare(strict_types=1);

namespace App\Modules\Rides\Console;

use App\Modules\Identity\Enums\Role;
use App\Modules\Identity\Models\Role as RoleModel;
use App\Modules\Identity\Models\User;
use App\Modules\Rides\Enums\DriverDocumentType;
use App\Modules\Rides\Enums\DriverStatus;
use App\Modules\Rides\Models\DriverProfile;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Valide un dossier de chauffeur, en développement.
 *
 * **Une commande, pas un endpoint.** La vraie file de modération est un écran web
 * — un permis et une carte grise se lisent côte à côte, ce qui ne se fait pas au
 * pouce (E2). L'espace web n'existe pas encore, et sans dossier validé aucun
 * écran de chauffeur ne prouve quoi que ce soit : cette commande débloque le test
 * de bout en bout sans préjuger de l'écran à construire.
 *
 * Elle **contourne l'exigence des quatre pièces**, ce que l'endpoint de
 * modération refuse. C'est assumé pour un poste de développement, et c'est
 * exactement pourquoi elle refuse de tourner en production : valider un chauffeur
 * dont personne n'a vu le permis est le risque que toute l'étape 2 existe pour
 * écarter.
 */
final class ApproveDriverCommand extends Command
{
    protected $signature = 'motoboy:approve-driver
        {phone : Numéro du chauffeur, au format +237…}
        {--reject= : Refuse le dossier avec ce motif, au lieu de le valider}';

    protected $description = 'Développement : valide ou refuse un dossier de chauffeur.';

    public function handle(): int
    {
        if ($this->getLaravel()->environment('production')) {
            $this->error('Refusé en production : la modération passe par l\'espace administration.');

            return self::FAILURE;
        }

        $phone = $this->argument('phone');
        $phone = is_string($phone) ? trim($phone) : '';

        $user = User::query()->where('phone', $phone)->first();

        if ($user === null) {
            $this->error("Aucun compte pour {$phone}.");

            return self::FAILURE;
        }

        $profile = DriverProfile::query()->where('user_id', $user->id)->first();

        if ($profile === null) {
            $this->error('Ce compte n\'a pas déposé de dossier de chauffeur.');

            return self::FAILURE;
        }

        $reason = $this->option('reject');

        if (is_string($reason) && $reason !== '') {
            $profile->update([
                'status' => DriverStatus::Rejected,
                'review_note' => $reason,
                'reviewed_at' => now(),
            ]);

            $this->line("Dossier refusé : {$reason}");

            return self::SUCCESS;
        }

        DB::transaction(function () use ($profile, $user): void {
            $profile->update([
                'status' => DriverStatus::Approved,
                'review_note' => null,
                'reviewed_at' => now(),
            ]);

            // Le rôle est normalement attribué au dépôt ; on le rattrape pour un
            // dossier créé à la main en base.
            $roleId = RoleModel::query()->where('name', Role::Driver->value)->value('id');

            if ($roleId !== null) {
                DB::table('role_user')->insertOrIgnore([
                    'user_id' => $user->id,
                    'role_id' => $roleId,
                ]);
            }
        });

        $missing = array_values(array_diff(
            array_map(fn (DriverDocumentType $type): string => $type->value, DriverDocumentType::cases()),
            $profile->documents()->pluck('type')->all(),
        ));

        $this->line("Dossier validé pour {$user->first_name} {$user->last_name} ({$phone}).");

        if ($missing !== []) {
            // Dit, pas bloqué : le testeur doit savoir que ce dossier n'aurait
            // pas passé la vraie modération.
            $this->warn('Pièces manquantes, tolérées ici : '.implode(', ', $missing).'.');
        }

        return self::SUCCESS;
    }
}
