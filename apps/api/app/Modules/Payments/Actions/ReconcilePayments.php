<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Payments\Contracts\PaymentGateway;
use App\Modules\Payments\Data\GatewayTransaction;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Models\Payment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;

/**
 * Confronte le relevé du prestataire aux paiements enregistrés (B4, I7).
 *
 * **Sans ce contrôle, « le passager a payé mais n'a pas de billet » ne se
 * découvre que par réclamation.** Un webhook perdu ne laisse aucune trace
 * locale : le paiement reste `PROCESSING` chez nous et abouti chez le
 * prestataire, et rien ne le signale.
 *
 * L'écart est **cherché dans les deux sens**. Ne regarder que les paiements
 * connus laisserait passer exactement le cas qu'on cherche — celui dont on n'a
 * jamais entendu parler.
 *
 * Cette Action **ne corrige rien**. Confirmer automatiquement un paiement sur la
 * foi d'un relevé émettrait un billet sans jamais avoir vu le webhook, et un
 * relevé erroné se propagerait en billets. Elle signale ; un humain tranche.
 */
final class ReconcilePayments
{
    public function __construct(private readonly PaymentGateway $gateway) {}

    /**
     * @return array{checked: int, missing_locally: list<string>, missing_remotely: list<string>, mismatched: list<string>}
     */
    public function handle(?CarbonImmutable $from = null, ?CarbonImmutable $to = null): array
    {
        $to ??= CarbonImmutable::now();
        $from ??= $to->subDay();

        $remote = $this->gateway->listTransactions($from, $to);

        /** @var array<string, GatewayTransaction> $byReference */
        $byReference = [];

        foreach ($remote as $transaction) {
            $byReference[$transaction->providerReference] = $transaction;
        }

        $local = Payment::query()
            ->whereNotNull('provider_reference')
            ->whereBetween('created_at', [$from, $to])
            ->get();

        $missingRemotely = [];
        $mismatched = [];
        $seen = [];

        foreach ($local as $payment) {
            $reference = (string) $payment->provider_reference;
            $seen[$reference] = true;
            $transaction = $byReference[$reference] ?? null;

            if ($transaction === null) {
                // Abouti chez nous, inconnu du prestataire : le cas le plus
                // grave, une agence créditée pour de l'argent jamais encaissé.
                if ($payment->status === PaymentStatus::Succeeded) {
                    $missingRemotely[] = $payment->reference;
                }

                continue;
            }

            if ($transaction->amount !== $payment->amount || $transaction->status !== $payment->status) {
                $mismatched[] = $payment->reference;
            }
        }

        $missingLocally = [];

        foreach ($byReference as $reference => $transaction) {
            if (!isset($seen[$reference]) && $transaction->status === PaymentStatus::Succeeded) {
                // Le passager a payé et n'a pas de billet.
                $missingLocally[] = $reference;
            }
        }

        $report = [
            'checked' => $local->count(),
            'missing_locally' => $missingLocally,
            'missing_remotely' => $missingRemotely,
            'mismatched' => $mismatched,
        ];

        $this->alert($report);

        return $report;
    }

    /**
     * @param  array{checked: int, missing_locally: list<string>, missing_remotely: list<string>, mismatched: list<string>}  $report
     */
    private function alert(array $report): void
    {
        $anomalies = count($report['missing_locally'])
            + count($report['missing_remotely'])
            + count($report['mismatched']);

        if ($anomalies === 0) {
            return;
        }

        Log::error('Réconciliation des paiements : écarts détectés', $report);
    }
}
