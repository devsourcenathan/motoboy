<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Gateways;

use App\Modules\Payouts\Contracts\PayoutGateway;
use App\Modules\Payouts\Data\DisbursementEvent;
use App\Modules\Payouts\Data\DisbursementIntent;
use App\Modules\Payouts\Data\GatewayDisbursement;
use App\Modules\Payouts\Enums\PayoutStatus;
use Illuminate\Support\Facades\Log;

/**
 * Pilote de développement et de test.
 *
 * Il reproduit le trait qui compte : **rien n'arrive immédiatement**. Le refus
 * forçable existe parce que c'est le cas dangereux — un décaissement en échec
 * dont le débit resterait écrit ferait croire l'agence payée alors qu'elle ne
 * l'est pas.
 */
final class FakePayoutGateway implements PayoutGateway
{
    private static ?GatewayDisbursement $next = null;

    public static function willReject(string $reason = 'Compte bénéficiaire injoignable'): void
    {
        self::$next = GatewayDisbursement::rejected($reason);
    }

    public static function reset(): void
    {
        self::$next = null;
    }

    public function disburse(DisbursementIntent $intent): GatewayDisbursement
    {
        if (self::$next !== null) {
            $forced = self::$next;
            self::$next = null;

            return $forced;
        }

        Log::info('Décaissement (pilote factice)', [
            'reference' => $intent->reference,
            'amount' => $intent->amount,
            'account' => $intent->accountType,
        ]);

        return GatewayDisbursement::accepted('fake-pay-'.bin2hex(random_bytes(8)));
    }

    /** @param array<string, list<string|null>> $headers */
    public function parseWebhook(string $payload, array $headers): ?DisbursementEvent
    {
        /** @var array<string, mixed>|null $data */
        $data = json_decode($payload, true);

        if (!is_array($data) || !isset($data['event_id'], $data['reference'], $data['status'])) {
            return null;
        }

        $status = PayoutStatus::tryFrom((string) $data['status']);

        // Seuls les états terminaux ont un sens ici : un prestataire qui
        // réannonce « en cours » n'apprend rien et ne doit rien changer.
        if ($status === null || $status->isInFlight()) {
            return null;
        }

        return new DisbursementEvent(
            eventId: (string) $data['event_id'],
            providerReference: (string) $data['reference'],
            status: $status,
            failureReason: isset($data['reason']) ? (string) $data['reason'] : null,
        );
    }

    public function name(): string
    {
        return 'fake';
    }
}
