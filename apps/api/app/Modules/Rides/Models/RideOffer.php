<?php

declare(strict_types=1);

namespace App\Modules\Rides\Models;

use App\Modules\Rides\Enums\OfferStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ce qu'un chauffeur propose sur une demande (E1).
 *
 * Un prix ferme et un délai annoncé. Le passager compare — c'est la promesse du
 * produit appliquée à un autre inventaire que les départs programmés.
 */
final class RideOffer extends Model
{
    /*
     * Les defauts vivent aussi cote PHP.
     *
     * La base en porte un, mais Eloquent ne relit pas la ligne apres insertion :
     * l'instance en memoire gardait `currency` a `null`, et la recopier dans la
     * course ecrasait le defaut au lieu d'en heriter.
     */
    protected $attributes = ['status' => 'PENDING', 'currency' => 'XAF'];

    protected $fillable = [
        'service_request_id', 'driver_profile_id',
        'price_amount', 'currency', 'eta_minutes',
        'status', 'expires_at',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'status' => OfferStatus::class,
        'expires_at' => 'immutable_datetime',
    ];

    /** @return BelongsTo<ServiceRequest, $this> */
    public function request(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class, 'service_request_id');
    }

    /** @return BelongsTo<DriverProfile, $this> */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(DriverProfile::class, 'driver_profile_id');
    }

    /** Acceptable tant qu'elle est en attente **et** pas périmée. */
    public function isAcceptable(): bool
    {
        return $this->status === OfferStatus::Pending && $this->expires_at->isFuture();
    }
}
