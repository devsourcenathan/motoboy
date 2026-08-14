<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Models;

use App\Modules\Bookings\Models\Booking;
use App\Modules\Bookings\Models\BookingPassenger;
use App\Modules\Tickets\Enums\TicketStatus;
use App\Modules\Trips\Models\Trip;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Un billet par passager.
 *
 * `reference` figure sur le billet et sert de secours à la saisie manuelle à
 * l'embarquement, quand la caméra est défaillante ou le QR abîmé (B3).
 */
final class Ticket extends Model
{
    protected $fillable = [
        'reference', 'booking_id', 'booking_passenger_id', 'trip_id',
        'qr_signature', 'status', 'issued_at',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'status' => TicketStatus::class,
        'issued_at' => 'immutable_datetime',
    ];

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /** @return BelongsTo<BookingPassenger, $this> */
    public function passenger(): BelongsTo
    {
        return $this->belongsTo(BookingPassenger::class, 'booking_passenger_id');
    }

    /** @return BelongsTo<Trip, $this> */
    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    /** @return HasMany<TicketValidation, $this> */
    public function validations(): HasMany
    {
        return $this->hasMany(TicketValidation::class);
    }
}
