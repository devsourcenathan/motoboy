<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Identity\Enums\Locale;
use App\Modules\Identity\Enums\OtpPurpose;
use App\Modules\Identity\Models\OtpCode;
use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Contracts\SmsSender;
use App\Modules\Notifications\Models\Notification;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\Support\FakeSmsSender;
use Tests\TestCase;

final class AuthTest extends TestCase
{
    use RefreshDatabase;

    private const PHONE = '+237690000001';

    private FakeSmsSender $sms;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);

        // Le port existe précisément pour rendre cette substitution triviale.
        $this->sms = new FakeSmsSender;
        $this->app->instance(SmsSender::class, $this->sms);
    }

    public function test_registration_sends_a_code_without_making_the_account_usable(): void
    {
        $this->register()->assertStatus(202)->assertJsonStructure(['expires_at', 'attempts_remaining']);

        $user = User::query()->where('phone', self::PHONE)->firstOrFail();

        // Le compte existe, mais c'est l'OTP qui fait foi (§8) : il reste
        // inutilisable tant que le téléphone n'est pas vérifié.
        $this->assertNull($user->phone_verified_at);
        $this->assertSame(1, $this->sms->count());
    }

    public function test_the_otp_is_sent_in_the_language_chosen_at_registration(): void
    {
        // Le tout premier message part avant même que le compte soit vérifié :
        // sa langue ne peut venir que de l'inscription (I10).
        $this->register(['locale' => 'en']);

        $this->assertSame(Locale::English, $this->sms->at(0)->locale);
        $this->assertStringContainsString('your code is', $this->sms->at(0)->body);

        $this->register(['phone' => '+237690000002', 'locale' => 'fr']);

        $this->assertStringContainsString('votre code est', $this->sms->last()->body);
    }

    public function test_the_code_is_never_stored_in_clear_text(): void
    {
        $this->register();

        $otp = OtpCode::query()->firstOrFail();
        $code = $this->extractCode($this->sms->at(0)->body);

        $this->assertNotSame($code, $otp->code_hash);
        $this->assertTrue(Hash::check($code, $otp->code_hash));
    }

    public function test_the_code_is_never_written_to_the_notification_log(): void
    {
        $this->register();

        $code = $this->extractCode($this->sms->at(0)->body);
        $payload = json_encode(Notification::query()->firstOrFail()->payload);

        // Cette table est consultée en exploitation : y consigner le code
        // reviendrait à publier un secret d'authentification.
        $this->assertIsString($payload);
        $this->assertStringNotContainsString($code, $payload);
    }

    public function test_verifying_the_code_marks_the_phone_and_issues_a_token(): void
    {
        $this->register();

        $response = $this->verify($this->extractCode($this->sms->at(0)->body))->assertOk();

        $this->assertNotEmpty($response->json('token'));
        $this->assertTrue($response->json('user.phone_verified'));
        $this->assertNotNull(User::query()->where('phone', self::PHONE)->value('phone_verified_at'));
    }

    public function test_a_code_cannot_be_used_twice(): void
    {
        $this->register();
        $code = $this->extractCode($this->sms->at(0)->body);

        $this->verify($code)->assertOk();
        $this->verify($code)->assertStatus(422)->assertJson(['code' => 'OTP_EXPIRED']);
    }

    public function test_a_login_code_cannot_validate_a_registration(): void
    {
        $this->register();
        $code = $this->extractCode($this->sms->at(0)->body);

        // Sans cette séparation, un code intercepté sur un canal servirait sur
        // l'autre.
        $this->verify($code, OtpPurpose::Login)
            ->assertStatus(422)
            ->assertJson(['code' => 'OTP_EXPIRED']);
    }

    public function test_a_wrong_code_burns_an_attempt_and_the_fourth_closes_it(): void
    {
        $this->register();

        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $this->verify('000000')
                ->assertStatus(422)
                ->assertJson(['code' => 'OTP_INVALID', 'details' => ['attempts_remaining' => 4 - $attempt]]);
        }

        $this->verify('000000')->assertStatus(422)->assertJson(['code' => 'OTP_TOO_MANY_ATTEMPTS']);

        // Même le bon code ne passe plus : la limite de §8 est absolue.
        $this->verify($this->extractCode($this->sms->at(0)->body))
            ->assertStatus(422)
            ->assertJson(['code' => 'OTP_TOO_MANY_ATTEMPTS']);
    }

    public function test_an_expired_code_is_refused(): void
    {
        $this->register();
        $code = $this->extractCode($this->sms->at(0)->body);

        OtpCode::query()->update(['expires_at' => now()->subMinute()]);

        $this->verify($code)->assertStatus(422)->assertJson(['code' => 'OTP_EXPIRED']);
    }

    public function test_asking_for_a_new_code_kills_the_previous_one(): void
    {
        $this->register();
        $first = $this->extractCode($this->sms->at(0)->body);

        $this->postJson('/api/v1/auth/otp/resend', [
            'phone' => self::PHONE,
            'purpose' => OtpPurpose::Registration->value,
        ])->assertStatus(202);

        // Sans cette invalidation, deux codes circuleraient et le plus ancien
        // resterait exploitable après un renvoi.
        $this->verify($first)->assertStatus(422)->assertJson(['code' => 'OTP_INVALID']);
        $this->verify($this->extractCode($this->sms->at(1)->body))->assertOk();
    }

    public function test_an_unverified_registration_can_be_reclaimed(): void
    {
        $this->register(['first_name' => 'Awa']);

        // Sinon, saisir le numéro de quelqu'un d'autre le bloquerait
        // définitivement — un squattage trivial. L'OTP garde la porte.
        $this->register(['first_name' => 'Paul'])->assertStatus(202);

        $this->assertSame('Paul', User::query()->where('phone', self::PHONE)->value('first_name'));
    }

    public function test_a_verified_number_cannot_be_registered_again(): void
    {
        $this->register();
        $this->verify($this->extractCode($this->sms->at(0)->body))->assertOk();

        $this->register()->assertStatus(422)->assertJson(['code' => 'VALIDATION_FAILED']);
    }

    public function test_the_sms_budget_is_protected_per_number(): void
    {
        config(['sms.throttle.per_phone_per_hour' => 3]);

        $this->register();

        for ($i = 0; $i < 2; $i++) {
            $this->postJson('/api/v1/auth/otp/resend', [
                'phone' => self::PHONE,
                'purpose' => OtpPurpose::Registration->value,
            ])->assertStatus(202);
        }

        // Chaque demande envoie un SMS payant, et l'OTP est le seul canal sans
        // alternative (I8) : sans borne, un script vide le budget.
        $this->postJson('/api/v1/auth/otp/resend', [
            'phone' => self::PHONE,
            'purpose' => OtpPurpose::Registration->value,
        ])->assertStatus(429)->assertJson(['code' => 'RATE_LIMITED']);

        $this->assertSame(3, $this->sms->count());
    }

    /**
     * Inscrit mais jamais confirmé : un état à part, pas un « introuvable ».
     *
     * Les deux tombaient sous `NOT_FOUND`, dont le libellé — « Élément
     * introuvable. » — ne dit ni de s'inscrire ni de reprendre la confirmation.
     * C'est le seul écran où l'utilisateur ne peut rien faire d'autre, et il y
     * restait bloqué : constaté en testant l'application sur un vrai téléphone.
     */
    public function test_login_says_an_account_exists_but_was_never_confirmed(): void
    {
        $this->register();

        $this->postJson('/api/v1/auth/login', ['phone' => self::PHONE])
            ->assertStatus(409)
            ->assertJson(['code' => 'ACCOUNT_NOT_VERIFIED']);
    }

    public function test_login_says_when_no_account_exists_at_all(): void
    {
        $this->postJson('/api/v1/auth/login', ['phone' => '+237699111222'])
            ->assertStatus(404)
            ->assertJson(['code' => 'ACCOUNT_NOT_FOUND']);
    }

    public function test_me_and_logout_follow_the_token(): void
    {
        $this->register();
        $token = $this->verify($this->extractCode($this->sms->at(0)->body))->json('token');

        $this->assertIsString($token);
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->getJson('/api/v1/me', $headers)->assertOk()->assertJson(['phone' => self::PHONE]);

        $this->postJson('/api/v1/auth/logout', [], $headers)->assertStatus(204);

        // La garantie réelle est la disparition du jeton : l'aller-retour HTTP
        // seul ne la prouverait pas, Laravel conservant l'utilisateur résolu
        // entre deux requêtes d'un même test.
        $this->assertSame(0, DB::table('personal_access_tokens')->count());

        $this->app->make('auth')->forgetGuards();

        $this->getJson('/api/v1/me', $headers)->assertStatus(401)->assertJson(['code' => 'UNAUTHENTICATED']);
    }

    public function test_validation_errors_use_the_contract_envelope(): void
    {
        $this->postJson('/api/v1/auth/login', ['phone' => 'pas-un-numero'])
            ->assertStatus(422)
            ->assertJson(['code' => 'VALIDATION_FAILED'])
            ->assertJsonStructure(['code', 'message', 'errors' => ['phone']]);
    }

    /**
     * @param  array<string, string>  $overrides
     * @return TestResponse<JsonResponse>
     */
    private function register(array $overrides = []): TestResponse
    {
        return $this->postJson('/api/v1/auth/register', [
            'phone' => self::PHONE,
            'first_name' => 'Awa',
            'last_name' => 'Nkeng',
            ...$overrides,
        ]);
    }

    /** @return TestResponse<JsonResponse> */
    private function verify(string $code, ?OtpPurpose $purpose = null): TestResponse
    {
        return $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => self::PHONE,
            'code' => $code,
            'purpose' => ($purpose ?? OtpPurpose::Registration)->value,
        ]);
    }

    private function extractCode(string $body): string
    {
        preg_match('/\b(\d{6})\b/', $body, $matches);

        return $matches[1] ?? '';
    }

    public function test_a_passenger_updates_only_the_fields_sent(): void
    {
        $user = User::factory()->create([
            'first_name' => 'Awa',
            'last_name' => 'Nkeng',
            'locale' => Locale::French,
        ]);

        $this->actingAs($user)
            ->patchJson('/api/v1/me', ['locale' => 'en'])
            ->assertOk()
            ->assertJsonPath('locale', 'en')
            // Le nom n'etait pas transmis : un ecran qui ne regle que la langue
            // ne doit pas ecraser ce qu'il ne montre pas.
            ->assertJsonPath('first_name', 'Awa');

        $this->assertSame(Locale::English, $user->refresh()->locale);
    }

    /**
     * Le telephone porte l'identite du compte et la destination des SMS. Le
     * laisser passer ici deplacerait un compte vers un numero qu'on ne detient
     * pas, sans jamais le prouver.
     */
    public function test_the_phone_cannot_be_changed_through_the_profile(): void
    {
        $user = User::factory()->create(['phone' => '+237690000123']);

        $this->actingAs($user)
            ->patchJson('/api/v1/me', ['phone' => '+237690000999'])
            ->assertOk();

        $this->assertSame('+237690000123', $user->refresh()->phone);
    }

    public function test_an_email_already_taken_is_refused(): void
    {
        User::factory()->create(['email' => 'occupe@motoboy.test']);
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson('/api/v1/me', ['email' => 'occupe@motoboy.test'])
            ->assertStatus(422);
    }

    /** Renvoyer sa propre adresse n'est pas un doublon. */
    public function test_a_passenger_keeps_their_own_email(): void
    {
        $user = User::factory()->create(['email' => 'moi@motoboy.test']);

        $this->actingAs($user)
            ->patchJson('/api/v1/me', ['email' => 'moi@motoboy.test'])
            ->assertOk();
    }

    public function test_the_profile_requires_a_session(): void
    {
        $this->patchJson('/api/v1/me', ['locale' => 'en'])->assertStatus(401);
    }
}
