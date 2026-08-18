<?php

declare(strict_types=1);

namespace App\Modules\Payments\Models;

use App\Modules\Bookings\Models\Booking;
use App\Modules\Payments\Enums\PaymentMethod;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Rides\Models\Ride;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Une tentative de paiement.
 *
 * Une réservation en porte **plusieurs**, dont une seule aboutie : avec Mobile
 * Money l'échec est banal — code erroné, solde insuffisant, délai dépassé — et
 * réessayer est le cas nominal. Un échec ne clôt pas la réservation et ne libère
 * pas les places tant que la tenue court (B2).
 *
 * L'unicité du paiement abouti est portée par un index unique partiel en base :
 * si la logique applicative se trompe, PostgreSQL refuse l'écriture.
 */
final class Payment extends Model
{
    protected $fillable = [
        'reference', 'booking_id', 'ride_id', 'amount', 'currency',
        'method', 'operator', 'provider', 'provider_reference',
        'idempotency_key', 'status', 'failure_reason',
        'aggregator_fee_amount', 'paid_at',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'method' => PaymentMethod::class,
        'status' => PaymentStatus::class,
        'paid_at' => 'immutable_datetime',
    ];

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /**
     * L'objet du paiement, quand c'est une course d'appel de service.
     *
     * Exclusive de `booking` : la base refuse un paiement rattache aux deux, ou a
     * aucun. La relation manquait, et tout ce qui remontait d'un paiement vers son
     * objet ne savait donc voir que les reservations.
     *
     * @return BelongsTo<Ride, $this>
     */
    public function ride(): BelongsTo
    {
        return $this->belongsTo(Ride::class);
    }
}
