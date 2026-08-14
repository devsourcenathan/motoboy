<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Payments\Contracts\PaymentGateway;
use App\Modules\Payments\Data\PaymentIntent;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Models\Payment;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use App\Support\Reference;
use Illuminate\Support\Facades\DB;

/**
 * Lance un encaissement sur une réservation.
 *
 * **Une réservation porte plusieurs tentatives, dont une seule aboutie.** Avec
 * Mobile Money l'échec est banal — code erroné, solde insuffisant, délai
 * dépassé — et réessayer est le cas nominal : un échec ne clôt pas la
 * réservation et ne libère pas les places tant que la tenue court (B2).
 */
final class InitiatePayment
{
    public function __construct(private readonly PaymentGateway $gateway) {}

    public function handle(
        Booking $booking,
        PaymentMethod $method,
        ?string $operator,
        ?string $payerPhone,
        string $idempotencyKey,
    ): Payment {
        $replay = $this->findReplay($idempotencyKey, $booking);

        if ($replay !== null) {
            return $replay;
        }

        $this->guardBooking($booking);

        $payment = DB::transaction(fn (): Payment => Payment::query()->create([
            'reference' => Reference::generate('PAY'),
            'booking_id' => $booking->id,
            'amount' => $booking->total_amount,
            'currency' => $booking->currency,
            'method' => $method,
            'operator' => $operator,
            'provider' => $this->gateway->name(),
            'idempotency_key' => $idempotencyKey,
            'status' => PaymentStatus::Pending,
        ]));

        // L'appel au prestataire est **hors transaction** : un appel réseau ne
        // doit jamais se dérouler avec un verrou ouvert, et sa lenteur — une à
        // deux minutes en Mobile Money — bloquerait tout le reste.
        $charge = $this->gateway->charge(new PaymentIntent(
            reference: $payment->reference,
            amount: $payment->amount,
            currency: $payment->currency,
            method: $method,
            operator: $operator,
            payerPhone: $payerPhone,
            idempotencyKey: $idempotencyKey,
        ));

        $payment->update([
            'status' => $charge->status,
            'provider_reference' => $charge->providerReference,
            'failure_reason' => $charge->failureReason,
            'aggregator_fee_amount' => $charge->feeAmount,
            'paid_at' => $charge->status === PaymentStatus::Succeeded ? now() : null,
        ]);

        return $payment->refresh();
    }

    private function guardBooking(Booking $booking): void
    {
        if ($booking->successfulPayment()->exists()) {
            throw ApiException::of(
                ErrorCode::PaymentAlreadySucceeded,
                'Cette réservation est déjà payée.',
            );
        }

        if ($booking->status !== BookingStatus::PendingPayment) {
            throw ApiException::of(
                ErrorCode::BookingExpired,
                'Cette réservation n\'attend plus de paiement.',
                ['status' => $booking->status->value],
            );
        }

        // La tenue peut avoir expiré sans que le job soit passé : refuser ici
        // évite d'encaisser pour une place que l'on s'apprête à libérer.
        if ($booking->expires_at !== null && $booking->expires_at->isPast()) {
            throw ApiException::of(
                ErrorCode::BookingExpired,
                'Le délai de paiement est dépassé, les places ont été libérées.',
                ['expired_at' => $booking->expires_at->toIso8601String()],
            );
        }
    }

    private function findReplay(string $key, Booking $booking): ?Payment
    {
        $payment = Payment::query()->where('idempotency_key', $key)->first();

        if ($payment === null) {
            return null;
        }

        if ($payment->booking_id !== $booking->id) {
            throw ApiException::of(ErrorCode::ValidationFailed, 'Clé d\'idempotence déjà utilisée.');
        }

        return $payment;
    }
}
