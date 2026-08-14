<?php

declare(strict_types=1);

namespace App\Modules\Payments\Gateways;

use App\Modules\Payments\Contracts\PaymentGateway;
use App\Modules\Payments\Data\GatewayCharge;
use App\Modules\Payments\Data\GatewayRefund;
use App\Modules\Payments\Data\PaymentIntent;
use App\Modules\Payments\Data\RefundEvent;
use App\Modules\Payments\Data\RefundIntent;
use App\Modules\Payments\Data\WebhookEvent;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Enums\RefundStatus;
use Illuminate\Support\Facades\Log;

/**
 * Pilote de développement et de test.
 *
 * C'est lui qui permet de construire tout le parcours de paiement **sans que
 * l'agrégateur soit choisi**, et de rejouer en test les cas qu'un vrai
 * prestataire ne produit qu'au hasard : refus immédiat, succès tardif après
 * expiration de la tenue, rejeu de webhook.
 *
 * Il reproduit fidèlement le trait qui compte : **rien n'est encaissé
 * immédiatement**. Un pilote qui renverrait un succès synchrone laisserait
 * écrire du code incapable de gérer le vrai Mobile Money.
 */
final class FakePaymentGateway implements PaymentGateway
{
    /** Force la prochaine réponse, pour les tests. */
    private static ?GatewayCharge $nextCharge = null;

    private static ?GatewayRefund $nextRefund = null;

    public static function willReject(string $reason = 'Solde insuffisant'): void
    {
        self::$nextCharge = GatewayCharge::rejected($reason);
    }

    /**
     * Le remboursement est l'opération où l'échec compte le plus : il laisse le
     * passager sans argent et sans billet. Il faut pouvoir le rejouer en test.
     */
    public static function willRejectRefund(string $reason = 'Compte source injoignable'): void
    {
        self::$nextRefund = GatewayRefund::rejected($reason);
    }

    public static function reset(): void
    {
        self::$nextCharge = null;
        self::$nextRefund = null;
    }

    public function charge(PaymentIntent $intent): GatewayCharge
    {
        if (self::$nextCharge !== null) {
            $forced = self::$nextCharge;
            self::$nextCharge = null;

            return $forced;
        }

        Log::info('Paiement (pilote factice)', [
            'reference' => $intent->reference,
            'amount' => $intent->amount,
            'method' => $intent->method->value,
        ]);

        // Jamais de succès synchrone : le passager doit saisir son code.
        return GatewayCharge::pending('fake-'.bin2hex(random_bytes(8)));
    }

    public function refund(RefundIntent $intent): GatewayRefund
    {
        if (self::$nextRefund !== null) {
            $forced = self::$nextRefund;
            self::$nextRefund = null;

            return $forced;
        }

        Log::info('Remboursement (pilote factice)', [
            'reference' => $intent->reference,
            'payment' => $intent->paymentReference,
            'amount' => $intent->amount,
        ]);

        // Accepté, pas encore arrivé : c'est le webhook qui confirmera.
        return GatewayRefund::accepted('fake-rfd-'.bin2hex(random_bytes(8)));
    }

    /** @param array<string, list<string|null>> $headers */
    public function parseWebhook(string $payload, array $headers): WebhookEvent|RefundEvent|null
    {
        /** @var array<string, mixed>|null $probe */
        $probe = json_decode($payload, true);

        // Le prestataire envoie tout sur le même endpoint : c'est la charge
        // utile qui dit s'il s'agit d'un encaissement ou d'un remboursement.
        if (is_array($probe) && ($probe['object'] ?? null) === 'refund') {
            return $this->parseRefund($probe);
        }

        return $this->parseCharge($payload);
    }

    /** @param array<string, mixed> $data */
    private function parseRefund(array $data): ?RefundEvent
    {
        if (!isset($data['event_id'], $data['reference'], $data['status'])) {
            return null;
        }

        $status = RefundStatus::tryFrom((string) $data['status']);

        if ($status === null) {
            return null;
        }

        return new RefundEvent(
            eventId: (string) $data['event_id'],
            providerReference: (string) $data['reference'],
            status: $status,
            failureReason: isset($data['reason']) ? (string) $data['reason'] : null,
            feeAmount: isset($data['fee']) ? (int) $data['fee'] : 0,
        );
    }

    private function parseCharge(string $payload): ?WebhookEvent
    {
        /** @var array<string, mixed>|null $data */
        $data = json_decode($payload, true);

        if (!is_array($data) || !isset($data['event_id'], $data['reference'], $data['status'])) {
            return null;
        }

        $status = PaymentStatus::tryFrom((string) $data['status']);

        if ($status === null) {
            return null;
        }

        return new WebhookEvent(
            eventId: (string) $data['event_id'],
            providerReference: (string) $data['reference'],
            status: $status,
            failureReason: isset($data['reason']) ? (string) $data['reason'] : null,
            feeAmount: isset($data['fee']) ? (int) $data['fee'] : 0,
        );
    }

    public function name(): string
    {
        return 'fake';
    }
}
