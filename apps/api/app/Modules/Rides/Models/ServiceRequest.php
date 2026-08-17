<?php

declare(strict_types=1);

namespace App\Modules\Rides\Models;

use App\Modules\Identity\Models\User;
use App\Modules\Places\Models\City;
use App\Modules\Rides\Enums\ServiceRequestStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Un appel de service (E1).
 *
 * Position **déclarée** : une ville du référentiel et un point de repère en
 * texte libre. Aucune coordonnée n'est captée — ni ici, ni ailleurs.
 */
final class ServiceRequest extends Model
{
    protected $attributes = ['status' => 'OPEN'];

    protected $fillable = [
        'reference', 'user_id',
        'origin_city_id', 'origin_landmark',
        'destination_city_id', 'destination_landmark',
        'passengers', 'note', 'status', 'expires_at',
        'cancelled_at', 'cancelled_by', 'cancellation_reason',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'status' => ServiceRequestStatus::class,
        'expires_at' => 'immutable_datetime',
        'cancelled_at' => 'immutable_datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function passenger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** @return BelongsTo<City, $this> */
    public function originCity(): BelongsTo
    {
        return $this->belongsTo(City::class, 'origin_city_id');
    }

    /** @return BelongsTo<City, $this> */
    public function destinationCity(): BelongsTo
    {
        return $this->belongsTo(City::class, 'destination_city_id');
    }

    /** @return HasMany<RideOffer, $this> */
    public function offers(): HasMany
    {
        return $this->hasMany(RideOffer::class);
    }

    /** @return HasOne<Ride, $this> */
    public function ride(): HasOne
    {
        return $this->hasOne(Ride::class);
    }

    /**
     * Une demande expirée n'accepte plus rien, même si son statut n'a pas encore
     * été rattrapé par la tâche planifiée.
     *
     * L'expiration est une question de temps, pas d'écriture : s'appuyer sur le
     * seul statut laisserait une fenêtre où l'on répond à une demande morte.
     */
    public function isOpenForOffers(): bool
    {
        return $this->status->acceptsOffers() && $this->expires_at->isFuture();
    }
}
