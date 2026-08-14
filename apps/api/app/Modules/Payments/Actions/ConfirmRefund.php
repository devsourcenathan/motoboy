<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Payments\Data\RefundEvent;
use App\Modules\Payments\Enums\RefundStatus;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payouts\Actions\RecordCancellationSettlement;
use Illuminate\Support\Facades\DB;

/**
 * Applique le verdict de l'agrégateur sur un remboursement.
 *
 * Rejouable sans effet supplémentaire : les prestataires réémettent, et un
 * remboursement déjà terminé ne doit produire ni seconde écriture ni seconde
 * date d'exécution (§29).
 */
final class ConfirmRefund
{
    public function __construct(private readonly RecordCancellationSettlement $settlement) {}

    public function handle(RefundEvent $event): ?Refund
    {
        $refund = Refund::query()
            ->where('provider_reference', $event->providerReference)
            ->with('booking')
            ->first();

        // Une référence inconnue n'est pas une panne : le webhook peut concerner
        // un autre environnement. Il est journalisé et ignoré.
        if ($refund === null) {
            return null;
        }

        if ($refund->status === RefundStatus::Completed) {
            return $refund;
        }

        DB::transaction(function () use ($refund, $event): void {
            $refund->update([
                'status' => $event->status,
                'completed_at' => $event->status === RefundStatus::Completed ? now() : null,
            ]);

            if ($event->status === RefundStatus::Completed) {
                // Le coût réel du remboursement n'est connu qu'ici : il vient en
                // écriture séparée, plafonnée par les frais d'annulation qui
                // n'ont pas déjà servi à couvrir la collecte (B5).
                $this->settlement->recordRefundFee($refund, $event->feeAmount);
            }
        });

        return $refund->refresh();
    }
}
