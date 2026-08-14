<?php

declare(strict_types=1);

namespace App\Modules\Fleet\Models;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Vehicle extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'agency_id', 'owner_user_id', 'owner_revenue_visible',
        'registration', 'brand', 'model', 'type',
        'seating_mode', 'capacity', 'condition', 'photo_path',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'type' => VehicleType::class,
        'seating_mode' => SeatingMode::class,
        'owner_revenue_visible' => 'boolean',
    ];

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /**
     * Le propriétaire accède à un espace en **consultation seule** : aucun
     * circuit financier ne le relie à la plateforme (I3).
     *
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    /** @return HasMany<VehicleSeat, $this> */
    public function seats(): HasMany
    {
        return $this->hasMany(VehicleSeat::class);
    }

    /** @return HasMany<VehicleDocument, $this> */
    public function documents(): HasMany
    {
        return $this->hasMany(VehicleDocument::class);
    }
}
