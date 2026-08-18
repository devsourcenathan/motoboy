<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Payments\Data\PaymentIntent;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Gateways\NotchPayGateway;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * L'adaptateur NotchPay.
 *
 * **Le webhook est ce que ces tests protegent avant tout.** C'est lui qui emet un
 * billet et credite un chauffeur : une signature acceptee a tort laisse quiconque
 * connait l'URL fabriquer un paiement.
 */
final class NotchPayGatewayTest extends TestCase
{
    private const HASH = 'cle-de-hachage-de-test';

    private function gateway(): NotchPayGateway
    {
        return new NotchPayGateway(
            baseUrl: 'https://api.notchpay.co',
            publicKey: 'pk_test',
            privateKey: 'sk_test',
            webhookHash: self::HASH,
        );
    }

    private function intent(string $operator = 'MTN'): PaymentIntent
    {
        return new PaymentIntent(
            reference: 'PAY-ABC123',
            amount: 6500,
            currency: 'XAF',
            method: PaymentMethod::MobileMoney,
            operator: $operator,
            payerPhone: '+237690000001',
            idempotencyKey: 'cle-test',
        );
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array{0: string, 1: array<string, list<string>>}
     */
    private function signed(array $body): array
    {
        $payload = json_encode($body) ?: '';

        return [$payload, ['X-Notch-Signature' => [hash_hmac('sha256', $payload, self::HASH)]]];
    }

    /**
     * L'encaissement demande **deux appels**, et le second est celui qui envoie
     * la sollicitation sur le telephone. S'arreter au premier laisserait une
     * transaction ouverte que personne ne paierait.
     */
    public function test_a_charge_creates_then_debits(): void
    {
        Http::fake([
            'api.notchpay.co/payments/*' => Http::response(['status' => 'Accepted']),
            'api.notchpay.co/payments' => Http::response(['transaction' => 'trx_1'], 201),
        ]);

        $charge = $this->gateway()->charge($this->intent());

        $this->assertSame(PaymentStatus::Processing, $charge->status);
        $this->assertSame('trx_1', $charge->providerReference);

        Http::assertSent(function ($request): bool {
            if (!str_contains($request->url(), '/payments/trx_1')) {
                return true;
            }

            return $request->data()['channel'] === 'cm.mtn'
                && $request->data()['data']['account_number'] === '+237690000001';
        });
    }

    /**
     * **Chaque cle a son en-tete.** La publique autorise l'appel, la privee ouvre
     * les operations sensibles. Les intervertir marcherait sur un encaissement et
     * echouerait sur un virement — une panne qui n'apparaitrait qu'au premier
     * decaissement, c'est-a-dire au pire moment.
     */
    public function test_each_key_travels_in_its_own_header(): void
    {
        Http::fake([
            'api.notchpay.co/payments/*' => Http::response(['status' => 'Accepted']),
            'api.notchpay.co/payments' => Http::response(['transaction' => 'trx_3'], 201),
        ]);

        $this->gateway()->charge($this->intent());

        Http::assertSent(fn ($request) => $request->header('Authorization')[0] === 'pk_test'
            && $request->header('X-Grant')[0] === 'sk_test');
    }

    /**
     * **Le cas qui a echoue en production.** NotchPay a repondu 201 avec
     * « Payment initialized », et l'adaptateur a rendu ce message de succes comme
     * motif d'echec — parce qu'il ne savait lire `transaction` que sous forme de
     * chaine. Imbriquee dans un objet, elle devenait invisible.
     */
    public function test_a_nested_transaction_reference_is_read(): void
    {
        Http::fake([
            'api.notchpay.co/payments/*' => Http::response(['status' => 'Accepted']),
            'api.notchpay.co/payments' => Http::response([
                'status' => 'Accepted',
                'message' => 'Payment initialized',
                'transaction' => ['reference' => 'trx_imbrique'],
            ], 201),
        ]);

        $charge = $this->gateway()->charge($this->intent());

        $this->assertSame(PaymentStatus::Processing, $charge->status);
        $this->assertSame('trx_imbrique', $charge->providerReference);
    }

    public function test_orange_uses_its_own_channel(): void
    {
        Http::fake([
            'api.notchpay.co/payments/*' => Http::response(['status' => 'Accepted']),
            'api.notchpay.co/payments' => Http::response(['transaction' => 'trx_2'], 201),
        ]);

        $this->gateway()->charge($this->intent('ORANGE'));

        Http::assertSent(fn ($request) => !str_contains($request->url(), '/payments/trx_2')
            || $request->data()['channel'] === 'cm.orange');
    }

    /** Sans canal connu, NotchPay redirigerait — le parcours mobile ne le permet pas. */
    public function test_an_unknown_operator_is_refused_before_any_call(): void
    {
        Http::fake();

        $this->assertSame(PaymentStatus::Failed, $this->gateway()->charge($this->intent('VISA'))->status);

        Http::assertNothingSent();
    }

    public function test_a_correctly_signed_webhook_is_accepted(): void
    {
        [$payload, $headers] = $this->signed([
            'event' => 'payment.complete',
            'data' => ['merchant_reference' => 'PAY-ABC123', 'status' => 'complete'],
        ]);

        $event = $this->gateway()->parseWebhook($payload, $headers);

        $this->assertNotNull($event);
        $this->assertTrue($event->signatureValid);
        $this->assertSame(PaymentStatus::Succeeded, $event->status);
        $this->assertSame('PAY-ABC123', $event->providerReference);
    }

    /**
     * **Le test qui compte.** Un corps modifie apres signature — le montant, la
     * reference — ne doit plus passer, sinon la signature ne protege rien.
     */
    public function test_a_tampered_body_is_refused(): void
    {
        [$payload, $headers] = $this->signed([
            'event' => 'payment.complete',
            'data' => ['merchant_reference' => 'PAY-ABC123', 'status' => 'complete'],
        ]);

        $tampered = str_replace('PAY-ABC123', 'PAY-VOLEUR', $payload);

        $event = $this->gateway()->parseWebhook($tampered, $headers);

        $this->assertNotNull($event);
        $this->assertFalse($event->signatureValid);
    }

    public function test_a_webhook_without_signature_is_refused(): void
    {
        $event = $this->gateway()->parseWebhook('{"event":"payment.complete"}', []);

        $this->assertNotNull($event);
        $this->assertFalse($event->signatureValid);
    }

    /** Les serveurs n'accordent pas la casse des en-tetes. */
    public function test_the_signature_header_is_read_whatever_its_case(): void
    {
        [$payload, $headers] = $this->signed([
            'event' => 'payment.failed',
            'data' => ['merchant_reference' => 'PAY-ABC123', 'status' => 'failed'],
        ]);

        $lowercase = ['x-notch-signature' => $headers['X-Notch-Signature']];

        $event = $this->gateway()->parseWebhook($payload, $lowercase);

        $this->assertNotNull($event);
        $this->assertTrue($event->signatureValid);
        $this->assertSame(PaymentStatus::Failed, $event->status);
    }
}
