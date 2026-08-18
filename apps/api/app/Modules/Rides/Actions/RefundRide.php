<?php

declare(strict_types=1);

namespace App\Modules\Rides\Actions;

use App\Modules\Payments\Actions\RefundPayment;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Enums\RefundReason;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\Refund;
use App\Modules\Rides\Enums\RideStatus;
use App\Modules\Rides\Models\Ride;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Support\Facades\DB;

/**
 * Ce que la plateforme rend, et quand (E4 bis).
 *
 * Deux cas, décidés le 17 août 2026 :
 *
 * - **annulation avant le départ** : remboursement intégral. Une fois la course
 *   démarrée, rien n'est rendu — le chauffeur a roulé.
 * - **chauffeur absent** : remboursement intégral **et** une marque au dossier.
 *   Rendre l'argent sans compter la fois n'empêche pas la récidive, et faute
 *   d'agence derrière lui, c'est la réputation de la plateforme qui s'use.
 */
final class RefundRide
{
    public function __construct(private readonly RefundPayment $refunds) {}

    /**
     * Le passager renonce.
     *
     * La règle tient en une phrase et se vérifie sur les états existants :
     * `MATCHED` n'a rien coûté au chauffeur, `IN_PROGRESS` si.
     */
    public function onCancellation(Ride $ride): ?Refund
    {
        if ($ride->status === RideStatus::InProgress) {
            return null;
        }

        return $this->refundInFull($ride, RefundReason::PassengerRequest, 'Course annulée avant le départ');
    }

    /**
     * Le chauffeur ne s'est pas présenté.
     *
     * Le compteur **ne se remet pas à zéro** : c'est lui qui justifiera une
     * suspension, et une marque qui s'effacerait ne prouverait rien.
     */
    public function onDriverNoShow(Ride $ride): ?Refund
    {
        if ($ride->status !== RideStatus::Matched) {
            throw ApiException::of(
                ErrorCode::OfferNotAcceptable,
                'Une absence ne se signale que sur une course qui n\'a pas démarré.',
            );
        }

        return DB::transaction(function () use ($ride): ?Refund {
            $ride->driver()->increment('no_show_count');

            return $this->refundInFull(
                $ride,
                RefundReason::AgencyTripCancelled,
                'Chauffeur non présenté',
            );
        });
    }

    /**
     * Rien à rembourser si rien n'a été encaissé — un paiement resté en attente,
     * une course jamais payée. Créer un remboursement à vide ferait croire à un
     * virement qui ne viendra pas.
     */
    private function refundInFull(Ride $ride, RefundReason $reason, string $description): ?Refund
    {
        $payment = Payment::query()
            ->where('ride_id', $ride->id)
            ->where('status', PaymentStatus::Succeeded->value)
            ->first();

        if ($payment === null) {
            return null;
        }

        return $this->refunds->handle(
            payment: $payment,
            reason: $reason,
            description: "{$description} — {$ride->reference}",
            amount: $payment->amount,
            // Aucun frais retenu : le passager n'y est pour rien dans les deux
            // cas, et retenir quoi que ce soit sur une absence du chauffeur
            // serait le faire payer pour autrui.
            feeAmount: 0,
        );
    }
}
