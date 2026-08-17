<?php

declare(strict_types=1);

namespace App\Modules\Rides\Models;

use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Identity\Models\User;
use App\Modules\Places\Models\City;
use App\Modules\Rides\Enums\DriverStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Le dossier d'un chauffeur indépendant (E2).
 *
 * **Aucune course sans validation.** Sans agence pour répondre d'un incident,
 * ce dossier est la seule chose qui sépare la plateforme d'un chauffeur dont
 * personne n'a vu le permis. C'est `DriverStatus::canDrive()` qui en décide, et
 * lui seul.
 */
final class DriverProfile extends Model
{
    /**
     * Le défaut vit aussi côté PHP.
     *
     * La base en porte un, mais Eloquent ne relit pas la ligne après insertion :
     * sans cela, le statut vaut `null` en mémoire juste après la création, et un
     * appel à `canDrive()` planterait sur l'instance qu'on vient de créer.
     */
    protected $attributes = ['status' => DriverStatus::Pending->value];

    protected $fillable = [
        'user_id', 'status',
        'license_number', 'license_expires_at',
        'vehicle_plate', 'vehicle_type', 'vehicle_model', 'vehicle_seats',
        'city_id', 'reviewed_by', 'reviewed_at', 'review_note',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'status' => DriverStatus::class,
        'vehicle_type' => VehicleType::class,
        'license_expires_at' => 'immutable_date',
        'reviewed_at' => 'immutable_datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<City, $this> */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    /** @return HasMany<DriverDocument, $this> */
    public function documents(): HasMany
    {
        return $this->hasMany(DriverDocument::class);
    }

    /**
     * Un permis périmé ne conduit pas, même sur un dossier validé.
     *
     * La date de validité est saisie au dépôt et personne ne repasse derrière :
     * sans ce contrôle, une validation d'il y a deux ans laisserait rouler
     * indéfiniment.
     */
    public function canDrive(): bool
    {
        return $this->status->canDrive() && $this->license_expires_at->isFuture();
    }
}
