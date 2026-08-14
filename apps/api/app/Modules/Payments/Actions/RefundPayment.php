<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Payments\Contracts\PaymentGateway;
use App\Modules\Payments\Data\RefundIntent;
use App\Modules\Payments\Enums\RefundReason;
use App\Modules\Payments\Enums\RefundStatus;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Support\Reference;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Enregistre puis exécute un remboursement.
 *
 * **Le remboursement part toujours vers le compte source du paiement**, jamais
 * vers un numéro déclaré après coup : sinon le circuit « je réserve, j'annule,
 * je me fais rembourser ailleurs » devient un vecteur de fraude immédiat (B5).
 * L'agrégateur reçoit la référence du paiement, pas une destination.
 */
final class RefundPayment
{
    public function __construct(private readonly PaymentGateway $gateway) {}

    /**
     * Enregistre **et** exécute, pour les appelants qui ne tiennent pas de
     * transaction ouverte.
     *
     * Ceux qui en tiennent une appellent `record()` dedans et `execute()`
     * dehors : lancer l'appel réseau depuis l'intérieur d'une transaction en
     * garderait les verrous ouverts pendant toute sa durée. Enchaîner les deux
     * ici *et* rappeler `execute()` ensuite enverrait **deux demandes** au
     * prestataire pour un seul remboursement.
     */
    public function handle(
        Payment $payment,
        RefundReason $reason,
        string $description,
        ?int $amount = null,
        int $feeAmount = 0,
        int $seats = 1,
        ?int $passengerId = null,
        ?int $initiatedBy = null,
    ): Refund {
        $refund = $this->record(
            $payment,
            $reason,
            $description,
            $amount,
            $feeAmount,
            $seats,
            $passengerId,
            $initiatedBy,
        );

        return $this->execute($refund, $payment);
    }

    /**
     * Envoie la demande au prestataire.
     *
     * **Hors transaction, délibérément.** Un appel réseau tenu à l'intérieur
     * garderait les verrous de la réservation ouverts pendant toute sa durée, et
     * un prestataire lent bloquerait l'inventaire d'un départ entier.
     *
     * Un échec n'est pas perdu : le remboursement reste en `FAILED` et le job de
     * rejeu le reprend. C'est le pire état possible pour un passager — sans
     * argent et sans billet —, il ne doit jamais rester silencieux (B5).
     */
    public function execute(Refund $refund, ?Payment $payment = null): Refund
    {
        $payment ??= $refund->payment;

        if ($payment === null) {
            return $refund;
        }

        try {
            $result = $this->gateway->refund(new RefundIntent(
                reference: $refund->reference,
                paymentReference: (string) $payment->provider_reference,
                amount: $refund->amount,
                currency: $refund->currency,
                idempotencyKey: $refund->idempotency_key,
            ));

            $refund->update([
                'status' => $result->status,
                'provider_reference' => $result->providerReference,
                'completed_at' => $result->status === RefundStatus::Completed ? now() : null,
            ]);
        } catch (Throwable $e) {
            // Une panne du prestataire est un échec de remboursement, pas une
            // erreur de l'annulation : la place est libérée, la réservation
            // annulée, et c'est le rejeu qui reprend la main.
            $refund->update(['status' => RefundStatus::Failed]);

            report($e);
        }

        return $refund->refresh();
    }

    /**
     * Écrit le remboursement et son débit au compte courant, sans toucher au
     * réseau. Sûr à l'intérieur d'une transaction appelante.
     */
    public function record(
        Payment $payment,
        RefundReason $reason,
        string $description,
        ?int $amount = null,
        int $feeAmount = 0,
        int $seats = 1,
        ?int $passengerId = null,
        ?int $initiatedBy = null,
    ): Refund {
        return DB::transaction(fn (): Refund => $this->write(
            $payment,
            $reason,
            $description,
            $amount ?? $payment->amount,
            $feeAmount,
            $seats,
            $passengerId,
            $initiatedBy,
        ));
    }

    private function write(
        Payment $payment,
        RefundReason $reason,
        string $description,
        int $amount,
        int $feeAmount,
        int $seats,
        ?int $passengerId,
        ?int $initiatedBy,
    ): Refund {
        $refund = Refund::query()->create([
            'reference' => Reference::generate('RFD'),
            'booking_id' => $payment->booking_id,
            'payment_id' => $payment->id,
            'booking_passenger_id' => $passengerId,
            'amount' => $amount,
            'fee_amount' => $feeAmount,
            'seats_count' => $seats,
            'currency' => $payment->currency,
            'reason' => $reason,
            'initiated_by' => $initiatedBy,
            'idempotency_key' => (string) Str::uuid(),
            'status' => RefundStatus::Pending,
            'retry_count' => 0,
        ]);

        // Chargement explicite : l'appelant peut arriver avec un paiement issu
        // d'une relation où `booking` n'a pas été ramené, et le mode strict
        // refuse le chargement paresseux plutôt que de le faire en silence.
        $booking = $payment->loadMissing('booking')->booking;

        if ($booking !== null && $amount > 0) {
            // Débit au compte courant : le remboursement se répercute sur ce que
            // l'agence percevra, quelle que soit la période où il survient (B4).
            AgencyLedgerEntry::query()->create([
                'agency_id' => $booking->agency_id,
                'booking_id' => $booking->id,
                'type' => 'REFUND_DEBIT',
                'amount' => -$amount,
                'currency' => $payment->currency,
                'reference_type' => 'refund',
                'reference_id' => $refund->id,
                'description' => $description,
                'occurred_at' => now(),
                'created_at' => now(),
            ]);
        }

        return $refund;
    }
}
