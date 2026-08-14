<?php

declare(strict_types=1);

namespace App\Modules\Payments\Gateways;

use App\Modules\Payments\Contracts\PaymentGateway;
use App\Modules\Payments\Data\GatewayCharge;
use App\Modules\Payments\Data\GatewayRefund;
use App\Modules\Payments\Data\GatewayTransaction;
use App\Modules\Payments\Data\PaymentIntent;
use App\Modules\Payments\Data\RefundEvent;
use App\Modules\Payments\Data\RefundIntent;
use App\Modules\Payments\Data\WebhookEvent;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Enums\RefundStatus;
use App\Modules\Payments\Models\Payment;
use Carbon\CarbonImmutable;
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

    /** @var list<GatewayTransaction>|null */
    private static ?array $transactions = null;

    /**
     * Force le relevé du prestataire, pour fabriquer un écart de réconciliation.
     *
     * @param  list<GatewayTransaction>  $transactions
     */
    public static function willReport(array $transactions): void
    {
        self::$transactions = $transactions;
    }

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
        self::$transactions = null;
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

    /**
     * Le pilote factice **rejoue ce que la base connaît déjà**.
     *
     * Un prestataire fictif ne peut pas inventer des transactions plausibles ;
     * en revanche, renvoyer les paiements aboutis permet de vérifier que la
     * réconciliation ne signale rien quand tout concorde — et les tests
     * fabriquent les écarts en retirant ou en ajoutant une ligne.
     *
     * @return list<GatewayTransaction>
     */
    public function listTransactions(CarbonImmutable $from, CarbonImmutable $to): array
    {
        if (self::$transactions !== null) {
            return self::$transactions;
        }

        $transactions = Payment::query()
            ->where('status', PaymentStatus::Succeeded->value)
            ->whereNotNull('provider_reference')
            ->whereBetween('paid_at', [$from, $to])
            ->get()
            ->map(fn (Payment $payment): GatewayTransaction => new GatewayTransaction(
                providerReference: (string) $payment->provider_reference,
                amount: $payment->amount,
                currency: $payment->currency,
                status: PaymentStatus::Succeeded,
                occurredAt: CarbonImmutable::parse((string) $payment->paid_at),
            ))
            ->all();

        return array_values($transactions);
    }

    public function name(): string
    {
        return 'fake';
    }
}
