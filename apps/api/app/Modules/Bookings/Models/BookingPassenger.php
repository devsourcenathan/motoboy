<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Models;

use App\Modules\Fleet\Models\VehicleSeat;
use App\Modules\Tickets\Models\Ticket;
use App\Modules\Trips\Models\Trip;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Un passager, un siège, un billet.
 *
 * Le grain du passager est nécessaire à l'annulation partielle — trois places
 * réservées, une annulée (B5).
 *
 * ⚠️ **Invariant que la base ne garantit pas seule.** `holds_seat` doit valoir
 * vrai si et seulement si la réservation est en `PENDING_PAYMENT` ou
 * `CONFIRMED` **et** le passager est `ACTIVE`. Il est maintenu dans la même
 * transaction que le statut de la réservation, et l'index unique partiel
 * `booking_passengers_seat_unique` s'appuie dessus pour empêcher la
 * double-vente (B2).
 *
 * `trip_id` est dénormalisé pour cette raison précise : l'index exige que les
 * deux colonnes vivent dans la même table.
 */
final class BookingPassenger extends Model
{
    protected $fillable = [
        'booking_id', 'trip_id', 'seat_id', 'holds_seat',
        'first_name', 'last_name', 'phone', 'status',
    ];

    /** @var array<string, string> */
    protected $casts = ['holds_seat' => 'boolean'];

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /** @return BelongsTo<Trip, $this> */
    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    /**
     * Null en mode `CAPACITY`, où la protection repose sur le compteur du départ
     * et non sur l'index unique partiel.
     *
     * @return BelongsTo<VehicleSeat, $this>
     */
    public function seat(): BelongsTo
    {
        return $this->belongsTo(VehicleSeat::class, 'seat_id');
    }

    /** @return HasOne<Ticket, $this> */
    public function ticket(): HasOne
    {
        return $this->hasOne(Ticket::class);
    }

    public function fullName(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }
}
