<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Payments\Data\WebhookEvent;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Enums\RefundReason;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payouts\Actions\RecordBookingSettlement;
use Illuminate\Support\Facades\DB;

/**
 * Applique le verdict de l'agrégateur.
 *
 * Appelée depuis le webhook, donc **rejouable sans effet supplémentaire** : les
 * prestataires réémettent, et le même événement peut arriver plusieurs fois
 * (§29 du brief).
 */
final class ConfirmPayment
{
    public function __construct(
        private readonly RecordBookingSettlement $settlement,
        private readonly RefundPayment $refund,
    ) {}

    public function handle(WebhookEvent $event): ?Payment
    {
        $payment = Payment::query()
            ->where('provider_reference', $event->providerReference)
            ->with('booking')
            ->first();

        // Une référence inconnue n'est pas une panne : un webhook peut concerner
        // un autre environnement, ou arriver avant que la transaction locale
        // soit visible. Il est journalisé et ignoré.
        if ($payment === null) {
            return null;
        }

        if ($event->status === PaymentStatus::Failed) {
            return $this->recordFailure($payment, $event);
        }

        if ($event->status !== PaymentStatus::Succeeded) {
            return $payment;
        }

        return $this->recordSuccess($payment, $event);
    }

    /**
     * Un échec ne clôt pas la réservation et **ne libère pas les places** : la
     * fenêtre de tenue court en entier, pour que le passager puisse recomposer
     * son code (B2).
     */
    private function recordFailure(Payment $payment, WebhookEvent $event): Payment
    {
        if ($payment->status === PaymentStatus::Succeeded) {
            return $payment;
        }

        $payment->update([
            'status' => PaymentStatus::Failed,
            'failure_reason' => $event->failureReason,
        ]);

        return $payment->refresh();
    }

    private function recordSuccess(Payment $payment, WebhookEvent $event): Payment
    {
        // Rejeu : déjà traité, rien à refaire.
        if ($payment->status === PaymentStatus::Succeeded) {
            return $payment;
        }

        $booking = $payment->booking;

        if ($booking === null) {
            return $payment;
        }

        /*
         * Le cas limite de B2 : le succès arrive **après** l'expiration de la
         * tenue, et les places ont été libérées puis potentiellement revendues.
         *
         * Le passager a payé et n'a plus de place : remboursement intégral
         * automatique, motif `LATE_PAYMENT`, avec des alternatives poussées dans
         * la notification (B5).
         */
        if ($booking->status !== BookingStatus::PendingPayment) {
            $payment->update([
                'status' => PaymentStatus::Succeeded,
                'provider_reference' => $event->providerReference,
                'aggregator_fee_amount' => $event->feeAmount,
                'paid_at' => now(),
            ]);

            $this->refund->handle(
                $payment->refresh(),
                RefundReason::LatePayment,
                'Paiement abouti après expiration de la tenue.',
            );

            return $payment->refresh();
        }

        DB::transaction(function () use ($payment, $event, $booking): void {
            $payment->update([
                'status' => PaymentStatus::Succeeded,
                'provider_reference' => $event->providerReference,
                'aggregator_fee_amount' => $event->feeAmount,
                'paid_at' => now(),
            ]);

            $booking->update([
                'status' => BookingStatus::Confirmed,
                'confirmed_at' => now(),
                // La tenue n'a plus d'objet : la place est vendue, pas tenue.
                'expires_at' => null,
            ]);

            $this->settlement->handle($booking, $payment->refresh());
        });

        return $payment->refresh();
    }
}
