<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Models;

use App\Modules\Bookings\Models\Booking;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class PayoutLine extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'payout_id', 'booking_id', 'ride_id',
        'gross_amount', 'commission_amount', 'refund_amount', 'net_amount',
    ];

    /** @return BelongsTo<Payout, $this> */
    public function payout(): BelongsTo
    {
        return $this->belongsTo(Payout::class);
    }

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
