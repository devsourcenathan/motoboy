<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Models;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Identity\Models\User;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\Refund;
use App\Modules\Trips\Models\Trip;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

final class Booking extends Model
{
    protected $fillable = [
        'reference', 'trip_id', 'agency_id', 'user_id', 'channel', 'created_by',
        'status', 'expires_at', 'seats_count', 'total_amount', 'currency',
        'contact_name', 'contact_phone',
        // Conditions figées à la création — recopiées depuis les conditions
        // commerciales de l'agence, jamais issues d'une saisie utilisateur.
        'commission_type', 'commission_value', 'fee_bearer',
        'cancellation_deadline_hours', 'cancellation_fee_type', 'cancellation_fee_value',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'status' => BookingStatus::class,
        'expires_at' => 'immutable_datetime',
        'confirmed_at' => 'immutable_datetime',
        'cancelled_at' => 'immutable_datetime',
    ];

    /** @return BelongsTo<Trip, $this> */
    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /**
     * Null en vente au guichet : le passager n'a pas de compte, nom et téléphone
     * suffisent (I2).
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<BookingPassenger, $this> */
    public function passengers(): HasMany
    {
        return $this->hasMany(BookingPassenger::class);
    }

    /**
     * Une réservation porte **plusieurs tentatives**, dont une seule aboutie.
     * Avec Mobile Money l'échec est banal, et réessayer est le cas nominal (B2).
     *
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** @return HasOne<Payment, $this> */
    public function successfulPayment(): HasOne
    {
        return $this->hasOne(Payment::class)->where('status', PaymentStatus::Succeeded->value);
    }

    /** @return HasMany<Refund, $this> */
    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    /**
     * Réservations dont la tenue est arrivée à terme.
     *
     * La libération est portée par un **job en queue**, jamais par un calcul
     * effectué à la lecture : l'index unique partiel s'appuie sur `holds_seat`,
     * qu'il faut donc réellement mettre à jour (B2).
     *
     * @param Builder<$this> $query
     */
    public function scopeExpiredHolds(Builder $query): void
    {
        $query->where('status', BookingStatus::PendingPayment)
            ->where('expires_at', '<=', now());
    }
}
