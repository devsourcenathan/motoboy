<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Identity\Enums\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Rôles et permissions — exécutable en production.
 *
 * Les permissions sont **indépendantes des rôles** (§9 du brief), ce qui permet
 * de déplacer une capacité d'un rôle à l'autre sans toucher au code.
 *
 * Ce seeder est la source de vérité de cette table de correspondance : il est
 * idempotent et se rejoue à chaque déploiement.
 */
final class RoleAndPermissionSeeder extends Seeder
{
    /** @var array<string, array{label: string, group: string}> */
    private const PERMISSIONS = [
        'trips.view' => ['label' => 'Consulter les départs', 'group' => 'trips'],
        'trips.manage' => ['label' => 'Créer et modifier les départs', 'group' => 'trips'],
        'trips.cancel' => ['label' => 'Annuler un départ', 'group' => 'trips'],
        'schedules.manage' => ['label' => 'Gérer les horaires récurrents', 'group' => 'trips'],

        'vehicles.view' => ['label' => 'Consulter les véhicules', 'group' => 'fleet'],
        'vehicles.manage' => ['label' => 'Gérer les véhicules', 'group' => 'fleet'],
        'drivers.manage' => ['label' => 'Gérer les chauffeurs', 'group' => 'fleet'],

        'stations.manage' => ['label' => 'Gérer ses gares', 'group' => 'places'],
        'places.manage' => ['label' => 'Curer le référentiel géographique', 'group' => 'places'],

        'bookings.view' => ['label' => 'Consulter les réservations', 'group' => 'bookings'],
        'bookings.manage' => ['label' => 'Gérer les réservations', 'group' => 'bookings'],
        'counter_sales.create' => ['label' => 'Vendre au guichet', 'group' => 'bookings'],

        'tickets.validate' => ['label' => 'Valider un billet à l\'embarquement', 'group' => 'tickets'],

        'payments.view' => ['label' => 'Consulter les paiements', 'group' => 'finance'],
        'refunds.manage' => ['label' => 'Déclencher un remboursement', 'group' => 'finance'],
        'payouts.view' => ['label' => 'Consulter les reversements', 'group' => 'finance'],
        'payouts.approve' => ['label' => 'Approuver un reversement', 'group' => 'finance'],
        'commercial_terms.manage' => ['label' => 'Définir les conditions commerciales', 'group' => 'finance'],

        'staff.manage' => ['label' => 'Gérer les comptes de son personnel', 'group' => 'identity'],
        // Distincte de `drivers.manage`, qui porte sur le personnel d'une
        // agence : celle-ci instruit les dossiers de chauffeurs indépendants.
        'independent_drivers.moderate' => ['label' => 'Modérer les chauffeurs indépendants', 'group' => 'identity'],
        'agencies.approve' => ['label' => 'Valider une agence', 'group' => 'identity'],
        'agencies.manage' => ['label' => 'Gérer les agences', 'group' => 'identity'],
        'users.manage' => ['label' => 'Gérer les comptes utilisateurs', 'group' => 'identity'],

        'audit.view' => ['label' => 'Consulter le journal d\'audit', 'group' => 'administration'],
        'platform.configure' => ['label' => 'Configurer la plateforme', 'group' => 'administration'],
    ];

    /** @var array<string, list<string>> */
    private const ROLE_PERMISSIONS = [
        // Le passager n'a aucune permission : ses droits découlent de la
        // possession de ses propres réservations, pas du RBAC.
        Role::Passenger->value => [],

        // Comme le passager : ses droits découlent de ce qu'il possède — son
        // dossier, ses offres, ses courses — et non du RBAC. Le rôle sert à
        // savoir quels onglets lui montrer et qui peut offrir sur une demande.
        Role::Driver->value => [],

        Role::Agency->value => [
            'trips.view', 'trips.manage', 'trips.cancel', 'schedules.manage',
            'vehicles.view', 'vehicles.manage', 'drivers.manage',
            'stations.manage',
            'bookings.view', 'bookings.manage', 'counter_sales.create',
            'tickets.validate',
            'payments.view', 'payouts.view',
            'staff.manage',
        ],

        // Deux permissions, et pas une de plus. Avec le compte agence, un agent
        // de gare accéderait au chiffre d'affaires, aux prix, à l'annulation des
        // départs et aux coordonnées de reversement — le vecteur de fraude
        // identifié en B4 deviendrait trivial dès que le login circule (B3).
        Role::Agent->value => [
            'tickets.validate',
            'trips.view',
        ],

        // Consultation seule, aucun circuit financier (I3).
        Role::Owner->value => [
            'vehicles.view',
        ],

        // Exploitation quotidienne (I4).
        Role::Admin->value => [
            'trips.view', 'bookings.view', 'payments.view',
            'refunds.manage', 'payouts.view', 'payouts.approve',
            'agencies.approve', 'agencies.manage',
            'independent_drivers.moderate',
            'places.manage',
            'vehicles.view',
        ],

        // Exploitation, plus la configuration de la plateforme et l'audit (I4).
        Role::SuperAdmin->value => [
            'trips.view', 'bookings.view', 'payments.view',
            'refunds.manage', 'payouts.view', 'payouts.approve',
            'agencies.approve', 'agencies.manage',
            'independent_drivers.moderate',
            'places.manage',
            'vehicles.view',
            'users.manage', 'commercial_terms.manage',
            'audit.view', 'platform.configure',
        ],
    ];

    /**
     * Le libellé d'un rôle.
     *
     * **Un `match` exhaustif, pas un tableau.** Cette liste était indexée par
     * rôle : ajouter un cas à l'énumération sans l'y ajouter ne se voyait qu'à
     * l'exécution — et s'est vu par cent-une erreurs « Undefined array key » au
     * moment d'introduire `DRIVER`. Sans branche par défaut, l'analyse statique
     * refuse désormais un cas oublié avant que le premier test ne tourne.
     */
    private function labelOf(Role $role): string
    {
        return match ($role) {
            Role::Passenger => 'Passager',
            Role::Driver => 'Chauffeur indépendant',
            Role::Agency => 'Agence',
            Role::Agent => "Agent d'embarquement",
            Role::Owner => 'Propriétaire de véhicule',
            Role::Admin => 'Administrateur',
            Role::SuperAdmin => 'Super administrateur',
        };
    }

    public function run(): void
    {
        $this->seedPermissions();
        $this->seedRoles();
        $this->syncRolePermissions();
    }

    private function seedPermissions(): void
    {
        foreach (self::PERMISSIONS as $name => $meta) {
            DB::table('permissions')->upsert(
                [[
                    'name' => $name,
                    'label' => $meta['label'],
                    'group' => $meta['group'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]],
                uniqueBy: ['name'],
                update: ['label', 'group', 'updated_at'],
            );
        }
    }

    private function seedRoles(): void
    {
        foreach (Role::cases() as $role) {
            DB::table('roles')->upsert(
                [[
                    'name' => $role->value,
                    'label' => $this->labelOf($role),
                    'is_system' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]],
                uniqueBy: ['name'],
                update: ['label', 'updated_at'],
            );
        }
    }

    /**
     * Synchronisation **complète** : retirer une permission de la table
     * ci-dessus doit la retirer en base. Un simple ajout laisserait traîner des
     * droits qu'on croit supprimés — le pire mode d'échec pour un RBAC.
     */
    private function syncRolePermissions(): void
    {
        /** @var array<string, int> $permissionIds */
        $permissionIds = DB::table('permissions')->pluck('id', 'name')->all();

        foreach (self::ROLE_PERMISSIONS as $roleName => $permissions) {
            $roleId = DB::table('roles')->where('name', $roleName)->value('id');

            if ($roleId === null) {
                continue;
            }

            $ids = array_map(
                static fn (string $name): int => $permissionIds[$name]
                    ?? throw new \RuntimeException("Permission inconnue : {$name}"),
                $permissions,
            );

            DB::table('permission_role')
                ->where('role_id', $roleId)
                ->whereNotIn('permission_id', $ids === [] ? [0] : $ids)
                ->delete();

            if ($ids === []) {
                continue;
            }

            // `insertOrIgnore` et non `upsert` : sur une table de liaison pure
            // il n'y a rien à mettre à jour, et un `upsert` dont la liste de
            // mise à jour est vide dégénère en `insert` simple — donc en
            // violation de contrainte au second passage.
            DB::table('permission_role')->insertOrIgnore(
                array_map(
                    static fn (int $permissionId): array => [
                        'role_id' => $roleId,
                        'permission_id' => $permissionId,
                    ],
                    $ids,
                ),
            );
        }
    }
}
