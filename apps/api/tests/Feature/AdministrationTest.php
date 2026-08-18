<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Administration\Models\AuditLog;
use App\Modules\Agencies\Models\Agency;
use App\Modules\Identity\Enums\Role as RoleEnum;
use App\Modules\Identity\Models\Role;
use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\PayoutAccount;
use App\Modules\Places\Models\City;
use App\Modules\Places\Models\CityRequest;
use App\Modules\Places\Models\Country;
use App\Modules\Places\Models\Station;
use Database\Seeders\CitySeeder;
use Database\Seeders\CountrySeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Espace d'administration (§23, §28, I4).
 *
 * Le partage `ADMIN` / `SUPER_ADMIN` suit l'exploitation quotidienne d'un côté,
 * la configuration de la plateforme de l'autre.
 */
final class AdministrationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(CountrySeeder::class);
        $this->seed(CitySeeder::class);
        $this->seed(RoleAndPermissionSeeder::class);

        $this->admin = $this->userWith(RoleEnum::Admin);
        $this->superAdmin = $this->userWith(RoleEnum::SuperAdmin);
    }

    public function test_an_agency_registers_itself_and_publishes_nothing_yet(): void
    {
        $this->postJson('/api/v1/agencies/register', [
            'name' => 'Général Express',
            'phone' => '+237690000100',
            'manager_first_name' => 'Awa',
            'manager_last_name' => 'Nkeng',
            'manager_phone' => '+237690000101',
        ])->assertCreated()->assertJsonStructure(['expires_at', 'attempts_remaining']);

        $agency = Agency::query()->where('name', 'Général Express')->firstOrFail();

        // Elle naît en attente : ni offre publiée, ni argent encaissé, tant que
        // l'administration ne l'a pas validée.
        $this->assertSame('PENDING', $agency->status);

        // Les conditions commerciales existent dès l'inscription : une agence
        // approuvée sans conditions est une incohérence de données, et la
        // première réservation lèverait une erreur.
        $this->assertNotNull($agency->commercialTerms);

        // Le dirigeant porte le rôle AGENCY **pour cette agence**.
        $manager = User::query()->where('phone', '+237690000101')->firstOrFail();
        $this->assertTrue($manager->hasRole(RoleEnum::Agency->value, $agency->id));
        $this->assertNull($manager->phone_verified_at);
    }

    public function test_a_verified_number_cannot_be_taken_over_by_a_new_agency(): void
    {
        $existing = User::factory()->create(['phone' => '+237690000200']);
        $existing->forceFill(['phone_verified_at' => now()])->save();

        // Sans ce refus, créer une agence au nom de quelqu'un d'autre
        // détournerait son compte.
        $this->postJson('/api/v1/agencies/register', [
            'name' => 'Agence adverse',
            'phone' => '+237690000201',
            'manager_first_name' => 'Faux',
            'manager_last_name' => 'Dirigeant',
            'manager_phone' => '+237690000200',
        ])->assertStatus(422);

        $this->assertSame(0, Agency::query()->count());
    }

    public function test_approving_an_agency_is_logged(): void
    {
        $agency = $this->pendingAgency();

        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/agencies/{$agency->reference}/approve")
            ->assertOk()
            ->assertJsonPath('status', 'APPROVED');

        // §28 impose de tracer la validation d'une agence : c'est l'opération
        // qui ouvre le droit de publier une offre et d'encaisser de l'argent.
        $log = AuditLog::query()->where('action', 'agency.approved')->firstOrFail();

        $this->assertSame($this->admin->id, $log->user_id);
        $this->assertSame(['status' => 'PENDING'], $log->old_values);
        $this->assertSame('APPROVED', $log->new_values['status'] ?? null);
    }

    public function test_approving_twice_is_refused(): void
    {
        $agency = $this->pendingAgency();

        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/agencies/{$agency->reference}/approve")
            ->assertOk();

        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/agencies/{$agency->reference}/approve")
            ->assertStatus(409)
            ->assertJsonPath('code', 'AGENCY_NOT_PENDING');
    }

    public function test_a_rejection_requires_a_reason(): void
    {
        $agency = $this->pendingAgency();

        // Un refus sans motif laisse l'agence sans recours et fait revenir le
        // même dossier à l'identique.
        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/agencies/{$agency->reference}/reject", [])
            ->assertStatus(422);

        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/agencies/{$agency->reference}/reject", [
                'reason' => 'Registre de commerce illisible.',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'REJECTED');
    }

    /**
     * Le vecteur de fraude que B4 nomme : compromission du compte agence,
     * modification du numéro, attente du jour de paie.
     */
    public function test_new_payout_details_are_never_active_on_submission(): void
    {
        $agency = $this->pendingAgency();
        $manager = $this->managerOf($agency);
        $agency->update(['status' => 'APPROVED']);

        $this->actingAs($manager)
            ->postJson('/api/v1/agency/payout-accounts', [
                'type' => 'MOBILE_MONEY',
                'operator' => 'MTN',
                'account_number' => '+237690000900',
                'account_name' => 'Général Express',
            ])
            ->assertCreated()
            ->assertJsonPath('verified', false);

        $account = PayoutAccount::query()->firstOrFail();
        $this->assertFalse((bool) $account->is_active);
        $this->assertNull($account->verified_at);

        // Le numéro complet ne circule pas dans la réponse.
        $this->assertStringNotContainsString('690000900', (string) json_encode(
            $this->actingAs($manager)->getJson('/api/v1/agency/payout-accounts')->json(),
        ));

        // L'agence est prévenue sur le contact qu'elle avait **avant** la
        // demande : notifier le nouveau numéro n'avertirait que l'attaquant.
        $notification = Notification::query()->where('type', 'PAYOUT_ACCOUNT_CHANGED')->firstOrFail();
        $this->assertSame($agency->phone, $notification->phone);

        $log = AuditLog::query()->where('action', 'payout_account.submitted')->firstOrFail();
        $this->assertSame($manager->id, $log->user_id);
    }

    public function test_verifying_new_details_deactivates_the_previous_ones(): void
    {
        $agency = $this->pendingAgency();

        $old = $agency->payoutAccounts()->create([
            'type' => 'MOBILE_MONEY', 'operator' => 'MTN',
            'account_number' => '+237690000111', 'account_name' => 'Ancien',
            'verified_at' => now(), 'is_active' => true,
        ]);

        $new = $agency->payoutAccounts()->create([
            'type' => 'MOBILE_MONEY', 'operator' => 'MTN',
            'account_number' => '+237690000222', 'account_name' => 'Nouveau',
            'is_active' => false,
        ]);

        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/payout-accounts/{$new->id}/verify")
            ->assertOk()
            ->assertJsonPath('verified', true);

        // Une agence n'a qu'un compte actif : en laisser deux rendrait le choix
        // implicite au moment du versement.
        $this->assertFalse((bool) $old->refresh()->is_active);
        $this->assertTrue((bool) $new->refresh()->is_active);
        $this->assertNotNull(AuditLog::query()->where('action', 'payout_account.verified')->first());
    }

    public function test_the_bounds_of_b4_are_enforced_server_side(): void
    {
        $agency = $this->pendingAgency();
        $url = "/api/v1/admin/agencies/{$agency->reference}/commercial-terms";

        // Reverser avant le départ est exclu : c'est la seule configuration qui
        // crée une créance irrécupérable.
        $this->actingAs($this->superAdmin)->patchJson($url, ['payout_delay_hours' => -1])->assertStatus(422);
        $this->actingAs($this->superAdmin)->patchJson($url, ['payout_delay_hours' => 200])->assertStatus(422);

        // Le passager ne peut jamais porter les frais d'agrégateur.
        $this->actingAs($this->superAdmin)->patchJson($url, ['fee_bearer' => 'PASSENGER'])->assertStatus(422);

        // Une agence ne peut pas rendre une réservation intégralement non
        // remboursable à l'intérieur de sa propre fenêtre : 50 % au plus.
        $this->actingAs($this->superAdmin)->patchJson($url, ['cancellation_fee_value' => 6000])->assertStatus(422);

        $this->actingAs($this->superAdmin)
            ->patchJson($url, ['commission_value' => 750, 'payout_delay_hours' => 48])
            ->assertOk()
            ->assertJsonPath('commission_value', 750)
            ->assertJsonPath('payout_delay_hours', 48);
    }

    public function test_only_a_partial_update_is_applied(): void
    {
        $agency = $this->pendingAgency();
        $before = $agency->commercialTerms()->firstOrFail()->cancellation_deadline_hours;

        $this->actingAs($this->superAdmin)
            ->patchJson("/api/v1/admin/agencies/{$agency->reference}/commercial-terms", [
                'commission_value' => 900,
            ])
            ->assertOk();

        // Une mise à jour partielle ne remet pas les autres champs à leur
        // valeur par défaut.
        $this->assertSame($before, $agency->commercialTerms()->firstOrFail()->cancellation_deadline_hours);
    }

    public function test_commercial_terms_are_out_of_reach_of_a_plain_admin(): void
    {
        $agency = $this->pendingAgency();

        // Termes négociés : `commercial_terms.manage` n'est portée que par le
        // super administrateur (I4).
        $this->actingAs($this->admin)
            ->patchJson("/api/v1/admin/agencies/{$agency->reference}/commercial-terms", [
                'commission_value' => 100,
            ])
            ->assertStatus(403);
    }

    public function test_a_manual_adjustment_needs_a_reason_and_is_logged(): void
    {
        $agency = $this->pendingAgency();
        $url = "/api/v1/admin/agencies/{$agency->reference}/ledger-adjustments";

        $this->actingAs($this->admin)->postJson($url, ['amount' => -5000])->assertStatus(422);
        $this->actingAs($this->admin)->postJson($url, [
            'amount' => 0, 'description' => 'Rien',
        ])->assertStatus(422);

        $this->actingAs($this->admin)
            ->postJson($url, ['amount' => -5000, 'description' => 'Geste commercial, litige 2026-08.'])
            ->assertCreated()
            ->assertJsonPath('amount.amount', -5000);

        $entry = AgencyLedgerEntry::query()->firstOrFail();

        // Reversable immédiatement : un ajustement ne se rattache à aucun
        // départ.
        $this->assertNull($entry->booking_id);
        $this->assertSame($this->admin->id, $entry->created_by);
        $this->assertNotNull(AuditLog::query()->where('action', 'ledger.adjusted')->first());
    }

    public function test_a_city_request_becomes_a_city(): void
    {
        $agency = $this->pendingAgency();
        $country = Country::query()->where('code', 'CM')->firstOrFail();

        $request = CityRequest::query()->create([
            'agency_id' => $agency->id,
            'country_id' => $country->id,
            'requested_name' => 'Mamfé',
            'status' => 'PENDING',
        ]);

        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/city-requests')
            ->assertOk()
            ->assertJsonPath('data.0.requested_name', 'Mamfé');

        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/city-requests/{$request->id}/resolve", ['decision' => 'APPROVE'])
            ->assertOk()
            ->assertJsonPath('status', 'APPROVED');

        $city = City::query()->where('name', 'Mamfé')->firstOrFail();
        $this->assertSame($city->id, $request->refresh()->resolved_city_id);
    }

    /**
     * La plupart des demandes seront des variantes d'orthographe : chacune doit
     * enrichir l'autocomplétion, pas dupliquer le référentiel.
     */
    public function test_a_spelling_variant_becomes_an_alias_not_a_duplicate(): void
    {
        $agency = $this->pendingAgency();
        $country = Country::query()->where('code', 'CM')->firstOrFail();
        $douala = City::query()->where('slug', 'douala')->firstOrFail();

        $request = CityRequest::query()->create([
            'agency_id' => $agency->id,
            'country_id' => $country->id,
            'requested_name' => 'Dla',
            'status' => 'PENDING',
        ]);

        $before = City::query()->count();

        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/city-requests/{$request->id}/resolve", [
                'decision' => 'APPROVE',
                'city_id' => $douala->id,
            ])
            ->assertOk();

        $this->assertSame($before, City::query()->count());
        $this->assertTrue($douala->aliases()->where('alias', 'Dla')->exists());
    }

    public function test_a_station_is_moderated_after_the_fact(): void
    {
        $agency = $this->pendingAgency();
        $douala = City::query()->where('slug', 'douala')->firstOrFail();

        $station = Station::query()->create([
            'agency_id' => $agency->id,
            'city_id' => $douala->id,
            'name' => 'Gare douteuse',
            'is_active' => true,
        ]);

        // La gare est publiée sans attendre : elle apparaît dans la file, pas
        // dans un sas bloquant.
        $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/stations')
            ->assertOk()
            ->assertJsonPath('data.0.id', $station->id);

        $this->actingAs($this->admin)
            ->postJson("/api/v1/admin/stations/{$station->id}/moderate", [
                'decision' => 'DEACTIVATE',
                'reason' => 'Doublon manifeste.',
            ])
            ->assertOk()
            ->assertJsonPath('is_active', false);

        // Marquée modérée : sans cette trace, la même gare reviendrait
        // indéfiniment dans la file.
        $this->assertNotNull($station->refresh()->moderated_at);
        $this->actingAs($this->admin)->getJson('/api/v1/admin/stations')->assertJsonPath('data', []);
    }

    public function test_the_audit_log_is_out_of_reach_of_a_plain_admin(): void
    {
        $this->actingAs($this->admin)->getJson('/api/v1/admin/audit-logs')->assertStatus(403);
        $this->actingAs($this->superAdmin)->getJson('/api/v1/admin/audit-logs')->assertOk();
    }

    public function test_the_dashboard_counts_what_calls_for_an_action(): void
    {
        $this->pendingAgency();

        $dashboard = $this->actingAs($this->admin)
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->json();

        $this->assertSame(1, $dashboard['agencies']['pending']);
        $this->assertSame(0, $dashboard['agencies']['approved']);
        $this->assertSame(0, $dashboard['revenue']['amount']);
    }

    public function test_a_passenger_reaches_no_admin_endpoint(): void
    {
        $this->actingAs(User::factory()->create())
            ->getJson('/api/v1/admin/agencies')
            ->assertStatus(403);
    }

    public function test_a_document_is_stored_without_its_original_name(): void
    {
        Storage::fake('documents');

        $agency = $this->pendingAgency();
        $agency->update(['status' => 'APPROVED']);

        $this->actingAs($this->managerOf($agency))
            ->post('/api/v1/agency/documents', [
                'type' => 'REGISTRATION',
                'file' => UploadedFile::fake()->create('registre de commerce.pdf', 12, 'application/pdf'),
            ])
            ->assertCreated()
            ->assertJsonPath('status', 'PENDING');

        $document = $agency->documents()->firstOrFail();

        // Le nom d'origine vient de l'utilisateur : le reprendre ferait entrer
        // sa chaîne dans un chemin de fichier, et deux agences déposant
        // « licence.pdf » s'écraseraient.
        $this->assertStringNotContainsString('registre', $document->file_path);
        $this->assertStringContainsString("agencies/{$agency->reference}", $document->file_path);
        Storage::disk('documents')->assertExists($document->file_path);
    }

    public function test_an_executable_upload_is_refused(): void
    {
        Storage::fake('documents');

        $agency = $this->pendingAgency();
        $agency->update(['status' => 'APPROVED']);

        $this->actingAs($this->managerOf($agency))
            ->post('/api/v1/agency/documents', [
                'type' => 'REGISTRATION',
                'file' => UploadedFile::fake()->create('charge.php', 4, 'application/x-php'),
            ])
            ->assertStatus(422);
    }

    private function pendingAgency(): Agency
    {
        $agency = Agency::query()->create([
            'reference' => 'AG-TEST'.random_int(100, 999),
            'name' => 'Général Express',
            'phone' => '+237690000100',
            'status' => 'PENDING',
        ]);

        $agency->commercialTerms()->create([]);

        return $agency->refresh();
    }

    private function managerOf(Agency $agency): User
    {
        $user = User::factory()->create();

        DB::table('role_user')->insert([
            'user_id' => $user->id,
            'role_id' => Role::query()->where('name', RoleEnum::Agency->value)->value('id'),
            'agency_id' => $agency->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $user;
    }

    private function userWith(RoleEnum $role): User
    {
        $user = User::factory()->create();

        DB::table('role_user')->insert([
            'user_id' => $user->id,
            'role_id' => Role::query()->where('name', $role->value)->value('id'),
            'agency_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $user;
    }
}
