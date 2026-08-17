<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Administration\Models\PlatformSetting;
use App\Modules\Administration\Support\RideCommission;
use App\Modules\Identity\Enums\Role as RoleEnum;
use App\Modules\Identity\Models\Role;
use App\Modules\Identity\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Le taux de commission d'une course (E4 bis).
 *
 * Un taux unique, réglable depuis le dashboard. Ce qui est protégé ici : qu'il ne
 * puisse pas être porté à un niveau qui prendrait la course entière, et qu'un
 * réglage absent ne fasse pas travailler la plateforme gratuitement.
 */
final class RideCommissionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_the_launch_rate_is_ten_percent(): void
    {
        $commission = app(RideCommission::class);

        $this->assertSame(1_000, $commission->currentBps());
        // 10 % de 12 500 : les points de base évitent le centime perdu.
        $this->assertSame(1_250, $commission->on(12_500));
    }

    /**
     * Un réglage absent — base neuve, ligne supprimée — ne doit pas valoir zéro :
     * la plateforme travaillerait gratuitement sans que rien ne le signale.
     */
    public function test_a_missing_setting_falls_back_to_the_default(): void
    {
        PlatformSetting::query()->where('key', RideCommission::KEY)->delete();

        $this->assertSame(RideCommission::DEFAULT_BPS, app(RideCommission::class)->currentBps());
    }

    /**
     * Un taux saisi avec un zéro de trop prendrait la course entière, et personne
     * ne s'en apercevrait avant le premier reversement.
     */
    public function test_the_rate_is_capped_however_it_is_written(): void
    {
        $commission = app(RideCommission::class);

        // Par l'accesseur.
        $this->assertSame(RideCommission::MAX_BPS, $commission->update(99_999, $this->superAdmin()));

        // Et par une écriture directe, qui ne passe pas par lui.
        PlatformSetting::query()->where('key', RideCommission::KEY)->update(['value' => '50000']);

        $this->assertSame(RideCommission::MAX_BPS, $commission->currentBps());
    }

    public function test_a_super_admin_reads_and_changes_the_rate(): void
    {
        $this->actingAs($this->superAdmin())
            ->getJson('/api/v1/admin/settings')
            ->assertOk()
            ->assertJsonPath('ride_commission_bps', 1_000);

        $this->actingAs($this->superAdmin())
            ->patchJson('/api/v1/admin/settings/ride-commission', ['commission_bps' => 1_500])
            ->assertOk()
            ->assertJsonPath('ride_commission_bps', 1_500);

        // Un taux touche tout l'argent qui sortira ensuite : §28 veut savoir qui.
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.ride_commission_changed']);
    }

    /**
     * Configurer la plateforme n'est pas une opération quotidienne : le partage
     * de I4 place ce réglage hors de portée d'un administrateur simple.
     */
    public function test_a_plain_admin_cannot_change_the_rate(): void
    {
        $admin = $this->userWith(RoleEnum::Admin);

        $this->actingAs($admin)->getJson('/api/v1/admin/settings')->assertForbidden();
        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/settings/ride-commission', ['commission_bps' => 500])
            ->assertForbidden();
    }

    public function test_an_out_of_range_rate_is_refused_with_a_message(): void
    {
        $this->actingAs($this->superAdmin())
            ->patchJson('/api/v1/admin/settings/ride-commission', ['commission_bps' => 9_000])
            ->assertStatus(422);
    }

    private function superAdmin(): User
    {
        return $this->userWith(RoleEnum::SuperAdmin);
    }

    private function userWith(RoleEnum $role): User
    {
        $user = User::factory()->create();

        DB::table('role_user')->insert([
            'user_id' => $user->id,
            'role_id' => Role::query()->where('name', $role->value)->value('id'),
        ]);

        return $user;
    }
}
