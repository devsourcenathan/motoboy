<?php

declare(strict_types=1);

namespace App\Modules\Payments\Models;

use App\Modules\Bookings\Models\Booking;
use App\Modules\Bookings\Models\BookingPassenger;
use App\Modules\Identity\Models\User;
use App\Modules\Payments\Enums\RefundReason;
use App\Modules\Payments\Enums\RefundStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Le remboursement part **toujours vers le compte source** du paiement, jamais
 * vers un numéro déclaré après coup. Dans le cas contraire, le circuit
 * « je réserve, j'annule, je me fais rembourser sur un autre numéro » devient un
 * vecteur de fraude immédiat (B5).
 */
final class Refund extends Model
{
    protected $fillable = [
        'reference', 'booking_id', 'payment_id', 'booking_passenger_id',
        'amount', 'currency', 'reason', 'initiated_by',
        'provider_reference', 'idempotency_key', 'status', 'retry_count', 'completed_at',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'reason' => RefundReason::class,
        'status' => RefundStatus::class,
        'completed_at' => 'immutable_datetime',
    ];

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /** @return BelongsTo<Payment, $this> */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    /**
     * Renseigné si remboursement partiel — une place sur trois annulée.
     *
     * @return BelongsTo<BookingPassenger, $this>
     */
    public function passenger(): BelongsTo
    {
        return $this->belongsTo(BookingPassenger::class, 'booking_passenger_id');
    }

    /**
     * Null si déclenché automatiquement.
     *
     * @return BelongsTo<User, $this>
     */
    public function initiator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }

    /**
     * Un remboursement en échec place le passager dans le pire état possible —
     * sans argent et sans billet. Il est rejoué automatiquement, puis remonté en
     * alerte à l'administration. Jamais laissé silencieux (B5).
     *
     * @param Builder<$this> $query
     */
    public function scopeNeedingRetry(Builder $query): void
    {
        $query->where('status', RefundStatus::Failed);
    }
}
