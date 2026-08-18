<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Identity\Enums\Locale;
use App\Modules\Notifications\Data\SmsMessage;
use App\Modules\Notifications\Senders\TechSoftSmsSender;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * L'adaptateur TechSoft.
 *
 * **Teste contre des reponses figees, jamais contre leur serveur.** Un test qui
 * appelle le prestataire echouerait le jour ou son reseau tousse, pour une raison
 * sans rapport avec le code — et consommerait des credits SMS a chaque execution.
 */
final class TechSoftSmsTest extends TestCase
{
    private function sender(): TechSoftSmsSender
    {
        return new TechSoftSmsSender(
            baseUrl: 'https://app.techsoft-sms.com/api/http',
            apiToken: 'jeton-de-test',
            senderId: 'MOTOBOY',
        );
    }

    private function message(): SmsMessage
    {
        return new SmsMessage(
            to: '+237690000001',
            body: 'MOTOBOY : votre code est 123456.',
            locale: Locale::French,
            type: 'OTP',
        );
    }

    public function test_it_sends_what_the_documented_contract_expects(): void
    {
        Http::fake([
            '*/sms/send' => Http::response([
                'status' => 'success',
                'data' => [['uid' => '683831eda796e', 'to' => '+237690000001']],
            ]),
        ]);

        $result = $this->sender()->send($this->message());

        $this->assertTrue($result->delivered);
        $this->assertSame('683831eda796e', $result->providerReference);

        Http::assertSent(function ($request): bool {
            $body = $request->data();

            /*
             * Le jeton voyage **dans le corps** et non dans un en-tete : c'est
             * inhabituel, c'est ce que leur API demande, et l'oublier donnerait un
             * refus d'authentification difficile a relier a sa cause.
             */
            return $request->url() === 'https://app.techsoft-sms.com/api/http/sms/send'
                && $body['api_token'] === 'jeton-de-test'
                && $body['sender_id'] === 'MOTOBOY'
                && $body['type'] === 'plain'
                // Sans le `+` : c'est la forme que montrent leurs exemples.
                && $body['recipient'] === '237690000001';
        });
    }

    /**
     * Un HTTP 200 ne suffit pas : leur API repond `status` dans le corps, et
     * traiter un refus comme un succes laisserait un passager attendre un code
     * qui ne partira jamais.
     */
    public function test_a_refusal_in_the_body_is_a_failure(): void
    {
        Http::fake([
            '*/sms/send' => Http::response(['status' => 'error', 'message' => 'Solde insuffisant.']),
        ]);

        $result = $this->sender()->send($this->message());

        $this->assertFalse($result->delivered);
        $this->assertSame('Solde insuffisant.', $result->error);
    }

    /** Une panne reseau se nomme, sans faire echouer l'appelant par une exception. */
    public function test_an_unreachable_provider_is_reported_not_thrown(): void
    {
        Http::fake(fn () => throw new \RuntimeException('connexion refusee'));

        $result = $this->sender()->send($this->message());

        $this->assertFalse($result->delivered);
        $this->assertNotNull($result->error);
    }
}
