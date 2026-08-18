<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Payments\Data\PaymentIntent;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Gateways\TranzakPaymentGateway;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * L'adaptateur Tranzak.
 *
 * **Le test qui compte est celui du webhook.** Tant que le schema de signature
 * n'est pas documente, l'adaptateur doit refuser tout evenement — accepter en
 * attendant laisserait quiconque connait l'URL declarer un paiement reussi, et le
 * webhook emet un billet puis credite un chauffeur.
 */
final class TranzakGatewayTest extends TestCase
{
    private function gateway(): TranzakPaymentGateway
    {
        return new TranzakPaymentGateway(
            baseUrl: 'https://sandbox.dsapi.tranzak.me',
            appId: 'app-de-test',
            appKey: 'SAND_cle',
        );
    }

    private function intent(): PaymentIntent
    {
        return new PaymentIntent(
            reference: 'PAY-ABC123',
            amount: 6500,
            currency: 'XAF',
            method: PaymentMethod::MobileMoney,
            operator: 'MTN',
            payerPhone: '+237690000001',
            idempotencyKey: 'cle-test',
        );
    }

    public function test_a_charge_is_created_pending_with_the_documented_fields(): void
    {
        Http::fake([
            '*/auth/token' => Http::response(['data' => ['token' => 'jeton', 'expiresIn' => 3600]]),
            '*/create-mobile-wallet-charge' => Http::response(['data' => ['requestId' => 'REQ-1']]),
        ]);

        $charge = $this->gateway()->charge($this->intent());

        /*
         * `Processing` et non `Pending` : la demande est partie chez
         * l'operateur et le passager a la sollicitation sur son telephone. Rien
         * n'est encaisse — le denouement arrive par webhook.
         */
        $this->assertSame(PaymentStatus::Processing, $charge->status);
        $this->assertSame('REQ-1', $charge->providerReference);

        Http::assertSent(function ($request): bool {
            if (!str_contains($request->url(), 'create-mobile-wallet-charge')) {
                return true;
            }

            $body = $request->data();

            // Le numero part **sans le `+`**, comme leur exemple le montre.
            return $body['mobileWalletNumber'] === '237690000001'
                && $body['mchTransactionRef'] === 'PAY-ABC123'
                && $body['currencyCode'] === 'XAF'
                && $body['amount'] === 6500;
        });
    }

    /**
     * Sans reference du prestataire, le webhook n'aura rien a quoi se raccrocher :
     * mieux vaut refuser que d'accepter un paiement qu'on ne saura jamais
     * rapprocher.
     */
    public function test_a_charge_without_a_provider_reference_is_refused(): void
    {
        Http::fake([
            '*/auth/token' => Http::response(['data' => ['token' => 'jeton', 'expiresIn' => 3600]]),
            '*/create-mobile-wallet-charge' => Http::response(['data' => []]),
        ]);

        $this->assertSame(PaymentStatus::Failed, $this->gateway()->charge($this->intent())->status);
    }

    /**
     * **Le garde-fou.** Il tombera le jour ou la verification sera branchee — et
     * c'est exactement le moment ou il faudra relire ce test plutot que le
     * supprimer.
     */
    public function test_every_webhook_is_refused_while_the_signature_scheme_is_unknown(): void
    {
        $event = $this->gateway()->parseWebhook(
            json_encode(['eventId' => 'evt-1', 'requestId' => 'REQ-1', 'status' => 'SUCCESSFUL']) ?: '',
            ['x-quelque-chose' => 'valeur'],
        );

        $this->assertFalse($event->signatureValid);
        $this->assertNotSame(PaymentStatus::Succeeded, $event->status);
    }
}
