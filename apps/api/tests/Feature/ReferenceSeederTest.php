<?php

declare(strict_types=1);

namespace Tests\Feature;

use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Les seeders de référence sont destinés à être **rejoués à chaque
 * déploiement**, y compris en production : ils sont la source de vérité de la
 * table de correspondance rôles/permissions.
 *
 * Un seeder non idempotent ne se manifeste qu'au second déploiement, en
 * production, sous forme de villes en double dans l'autocomplétion.
 */
final class ReferenceSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_reference_seeders_can_be_replayed_without_duplicating(): void
    {
        $this->seedReference();
        $first = $this->counts();

        $this->seedReference();
        $this->seedReference();

        $this->assertSame($first, $this->counts(), 'Les seeders de référence ne sont pas idempotents.');
    }

    public function test_retiring_a_permission_removes_it_from_the_role(): void
    {
        $this->seedReference();

        $agentRoleId = DB::table('roles')->where('name', 'AGENT')->value('id');
        $strayId = DB::table('permissions')->where('name', 'payouts.approve')->value('id');

        DB::table('permission_role')->insert([
            'role_id' => $agentRoleId,
            'permission_id' => $strayId,
        ]);

        // La synchronisation est complète, pas additive : un droit retiré de la
        // table de correspondance doit disparaître de la base. Le contraire est
        // le pire mode d'échec d'un RBAC — des droits qu'on croit supprimés.
        $this->seedReference();

        $this->assertDatabaseMissing('permission_role', [
            'role_id' => $agentRoleId,
            'permission_id' => $strayId,
        ]);
    }

    public function test_the_boarding_agent_role_stays_minimal(): void
    {
        $this->seedReference();

        $permissions = DB::table('permissions')
            ->join('permission_role', 'permission_role.permission_id', '=', 'permissions.id')
            ->join('roles', 'roles.id', '=', 'permission_role.role_id')
            ->where('roles.name', 'AGENT')
            ->orderBy('permissions.name')
            ->pluck('permissions.name')
            ->all();

        // Avec le compte agence, un agent de gare accéderait au chiffre
        // d'affaires, aux prix, à l'annulation des départs et aux coordonnées de
        // reversement — le vecteur de fraude de B4 deviendrait trivial dès que
        // le login circule entre plusieurs employés (B3).
        $this->assertSame(['tickets.validate', 'trips.view'], $permissions);
    }

    private function seedReference(): void
    {
        $this->seed([
            CountrySeeder::class,
            CitySeeder::class,
            RoleAndPermissionSeeder::class,
        ]);
    }

    /** @return array<string, int> */
    private function counts(): array
    {
        return [
            'countries' => DB::table('countries')->count(),
            'cities' => DB::table('cities')->count(),
            'city_aliases' => DB::table('city_aliases')->count(),
            'roles' => DB::table('roles')->count(),
            'permissions' => DB::table('permissions')->count(),
            'permission_role' => DB::table('permission_role')->count(),
        ];
    }
}
