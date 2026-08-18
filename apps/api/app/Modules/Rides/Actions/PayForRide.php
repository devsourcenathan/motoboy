<?php

declare(strict_types=1);

namespace App\Modules\Rides\Actions;

use App\Modules\Payments\Contracts\PaymentGateway;
use App\Modules\Payments\Data\PaymentIntent;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Models\Payment;
use App\Modules\Rides\Enums\RideStatus;
use App\Modules\Rides\Models\Ride;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use App\Support\Reference;
use Illuminate\Support\Facades\DB;

/**
 * Le passager paie la course retenue (E4 bis).
 *
 * **Une action à part, et non `InitiatePayment` généralisé.** Cette dernière est
 * gardée par des règles entièrement propres à la réservation — tenue de places
 * expirée, vente en ligne close, départ annulé — dont aucune n'a de sens ici. Ne
 * reste en commun que l'appel à la passerelle, qui est déjà un port. Fondre les
 * deux aurait produit une action avec deux jeux de gardes exclusifs, c'est-à-dire
 * deux actions dans un même fichier.
 *
 * Ce qui reste **volontairement identique** : le paiement est enregistré avant
 * l'appel réseau, et cet appel se fait **hors transaction**. Une à deux minutes
 * de Mobile Money avec un verrou ouvert bloquerait tout le reste.
 */
final class PayForRide
{
    public function __construct(private readonly PaymentGateway $gateway) {}

    public function handle(
        Ride $ride,
        PaymentMethod $method,
        ?string $operator,
        ?string $payerPhone,
        string $idempotencyKey,
    ): Payment {
        /*
         * Rejeu : la même clé rend le même paiement. Le téléphone perd le réseau
         * juste après avoir envoyé, réessaie, et sans cela le passager paierait
         * deux fois la même course.
         */
        $replay = Payment::query()
            ->where('ride_id', $ride->id)
            ->where('idempotency_key', $idempotencyKey)
            ->first();

        if ($replay !== null) {
            return $replay;
        }

        // On paie une course retenue, pas une course en cours ni terminée : le
        // prix se règle à l'acceptation de l'offre (E4 bis).
        if ($ride->status !== RideStatus::Matched) {
            throw ApiException::of(ErrorCode::OfferNotAcceptable, 'Cette course ne peut plus être payée.');
        }

        $already = Payment::query()
            ->where('ride_id', $ride->id)
            ->where('status', PaymentStatus::Succeeded->value)
            ->exists();

        if ($already) {
            throw ApiException::of(ErrorCode::PaymentAlreadySucceeded, 'Cette course est déjà payée.');
        }

        $payment = DB::transaction(fn (): Payment => Payment::query()->create([
            'reference' => Reference::generate('PAY'),
            'ride_id' => $ride->id,
            'amount' => $ride->price_amount,
            'currency' => $ride->currency,
            'method' => $method,
            'operator' => $operator,
            'provider' => $this->gateway->name(),
            'idempotency_key' => $idempotencyKey,
            'status' => PaymentStatus::Pending,
        ]));

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
}
