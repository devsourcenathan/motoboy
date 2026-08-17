<?php

declare(strict_types=1);

namespace App\Modules\Rides\Models;

use App\Modules\Identity\Models\User;
use App\Modules\Rides\Enums\RideStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * La course conclue (E1).
 *
 * Le prix est **recopié** depuis l'offre : celle-ci peut expirer ou être
 * nettoyée, alors que la course doit rester lisible telle qu'elle a été conclue,
 * des mois plus tard, parce qu'elle porte de l'argent.
 */
final class Ride extends Model
{
    /*
     * Les defauts vivent aussi cote PHP.
     *
     * La base en porte un, mais Eloquent ne relit pas la ligne apres insertion :
     * l'instance en memoire gardait `currency` a `null`, et la recopier dans la
     * course ecrasait le defaut au lieu d'en heriter.
     */
    protected $attributes = ['status' => 'MATCHED', 'currency' => 'XAF'];

    protected $fillable = [
        'reference', 'service_request_id', 'ride_offer_id', 'driver_profile_id',
        'price_amount', 'currency', 'status',
        'started_at', 'completed_at', 'cancelled_at', 'cancelled_by', 'cancellation_reason',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'status' => RideStatus::class,
        'started_at' => 'immutable_datetime',
        'completed_at' => 'immutable_datetime',
        'cancelled_at' => 'immutable_datetime',
    ];

    /** @return BelongsTo<ServiceRequest, $this> */
    public function request(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class, 'service_request_id');
    }

    /** @return BelongsTo<RideOffer, $this> */
    public function offer(): BelongsTo
    {
        return $this->belongsTo(RideOffer::class, 'ride_offer_id');
    }

    /** @return BelongsTo<DriverProfile, $this> */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(DriverProfile::class, 'driver_profile_id');
    }

    /** @return BelongsTo<User, $this> */
    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }
}
