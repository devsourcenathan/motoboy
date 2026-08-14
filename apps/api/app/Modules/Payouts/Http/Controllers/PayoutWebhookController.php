<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Http\Controllers;

use App\Modules\Payments\Models\PaymentWebhook;
use App\Modules\Payouts\Actions\ConfirmPayout;
use App\Modules\Payouts\Contracts\PayoutGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Réception des notifications de décaissement.
 *
 * Même discipline que pour les paiements : **journaliser d'abord, traiter
 * ensuite**, et **toujours répondre 204**. Un 500 sur une charge illisible
 * déclencherait une tempête de rejeux sans jamais résoudre le problème.
 *
 * Endpoint distinct de celui des paiements parce que le port l'est : rien
 * n'oblige le décaisseur à être l'agrégateur d'encaissement.
 */
final class PayoutWebhookController
{
    public function __invoke(
        Request $request,
        string $provider,
        PayoutGateway $gateway,
        ConfirmPayout $confirm,
    ): JsonResponse {
        $payload = $request->getContent();
        $event = $gateway->parseWebhook($payload, $request->headers->all());

        if ($event === null) {
            PaymentWebhook::query()->create([
                'provider' => $provider,
                'event_id' => 'unparsed-payout-'.hash('sha256', $payload),
                'payload' => $this->decode($payload),
                'signature_valid' => false,
                'received_at' => now(),
                'status' => 'FAILED',
                'error' => 'Charge utile illisible.',
            ]);

            return response()->json(null, 204);
        }

        $log = PaymentWebhook::query()->create([
            'provider' => $provider,
            'event_id' => $event->eventId,
            'payload' => $this->decode($payload),
            'signature_valid' => $event->signatureValid,
            'received_at' => now(),
            'status' => 'RECEIVED',
        ]);

        try {
            $payout = $confirm->handle($event);

            $log->update([
                'status' => $payout === null ? 'FAILED' : 'PROCESSED',
                'error' => $payout === null ? 'Référence de reversement inconnue.' : null,
                'processed_at' => now(),
            ]);
        } catch (Throwable $e) {
            $log->update(['status' => 'FAILED', 'error' => $e->getMessage()]);

            Log::error('Webhook de décaissement en échec', [
                'provider' => $provider,
                'event_id' => $event->eventId,
                'exception' => $e->getMessage(),
            ]);
        }

        return response()->json(null, 204);
    }

    /** @return array<string, mixed> */
    private function decode(string $payload): array
    {
        $decoded = json_decode($payload, true);

        return is_array($decoded) ? $decoded : ['raw' => $payload];
    }
}
