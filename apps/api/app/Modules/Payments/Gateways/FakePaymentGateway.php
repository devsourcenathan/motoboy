<?php

declare(strict_types=1);

namespace App\Modules\Payments\Gateways;

use App\Modules\Payments\Contracts\PaymentGateway;
use App\Modules\Payments\Data\GatewayCharge;
use App\Modules\Payments\Data\PaymentIntent;
use App\Modules\Payments\Data\WebhookEvent;
use App\Modules\Payments\Enums\PaymentStatus;
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

    public static function willReject(string $reason = 'Solde insuffisant'): void
    {
        self::$nextCharge = GatewayCharge::rejected($reason);
    }

    public static function reset(): void
    {
        self::$nextCharge = null;
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

    /** @param array<string, list<string|null>> $headers */
    public function parseWebhook(string $payload, array $headers): ?WebhookEvent
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
