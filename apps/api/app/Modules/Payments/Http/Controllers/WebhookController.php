<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Controllers;

use App\Modules\Payments\Actions\ConfirmPayment;
use App\Modules\Payments\Actions\ConfirmRefund;
use App\Modules\Payments\Contracts\PaymentGateway;
use App\Modules\Payments\Data\RefundEvent;
use App\Modules\Payments\Models\PaymentWebhook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Réception des notifications de l'agrégateur.
 *
 * **Journaliser d'abord, traiter ensuite.** Sans ce journal, un paiement perdu
 * est indébogable : la réconciliation quotidienne détecte l'écart, seul le
 * journal en explique l'origine (I7).
 *
 * **Toujours répondre 204, même en échec.** Les prestataires réémettent sur
 * erreur : renvoyer un 500 sur une charge utile qu'on ne sait pas lire
 * déclencherait une tempête de rejeux sans jamais résoudre le problème. Ce qui
 * n'a pas pu être traité reste dans le journal, avec son erreur.
 */
final class WebhookController
{
    public function __invoke(
        Request $request,
        string $provider,
        PaymentGateway $gateway,
        ConfirmPayment $confirm,
        ConfirmRefund $confirmRefund,
    ): JsonResponse {
        $payload = $request->getContent();
        $event = $gateway->parseWebhook($payload, $request->headers->all());

        if ($event === null) {
            // Une charge illisible n'a pas d'identifiant exploitable : on en
            // fabrique un stable à partir du contenu, pour ne pas perdre la
            // trace et pour que l'unicité continue de jouer son rôle.
            PaymentWebhook::query()->create([
                'provider' => $provider,
                'event_id' => 'unparsed-'.hash('sha256', $payload),
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
            // L'unicité de (provider, event_id) porte l'idempotence du rejeu :
            // les prestataires réémettent, et le même événement peut arriver
            // plusieurs fois.
            'event_id' => $event->eventId,
            'payload' => $this->decode($payload),
            'signature_valid' => $event->signatureValid,
            'received_at' => now(),
            'status' => 'RECEIVED',
        ]);

        try {
            // Encaissement ou remboursement : le prestataire envoie les deux
            // ici, et c'est l'adaptateur qui a déjà tranché.
            $applied = $event instanceof RefundEvent
                ? $confirmRefund->handle($event)
                : $confirm->handle($event);

            $log->update([
                'status' => $applied === null ? 'FAILED' : 'PROCESSED',
                'error' => $applied === null ? 'Référence inconnue.' : null,
                'processed_at' => now(),
            ]);
        } catch (Throwable $e) {
            $log->update(['status' => 'FAILED', 'error' => $e->getMessage()]);

            Log::error('Webhook de paiement en échec', [
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

        // La charge brute est conservée telle quelle si elle n'est pas du JSON :
        // c'est précisément dans ce cas qu'on aura besoin de la relire.
        return is_array($decoded) ? $decoded : ['raw' => $payload];
    }
}
