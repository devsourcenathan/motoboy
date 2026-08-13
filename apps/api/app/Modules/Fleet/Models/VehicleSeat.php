<?php

declare(strict_types=1);

namespace App\Modules\Fleet\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Uniquement pour les véhicules en mode `SEATED`. */
final class VehicleSeat extends Model
{
    protected $fillable = ['vehicle_id', 'label', 'row_index', 'column_index', 'is_bookable'];

    /** @var array<string, string> */
    protected $casts = ['is_bookable' => 'boolean'];

    /** @return BelongsTo<Vehicle, $this> */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /**
     * Exclut le siège chauffeur ou un strapontin non vendable.
     *
     * @param Builder<$this> $query
     */
    public function scopeBookable(Builder $query): void
    {
        $query->where('is_bookable', true);
    }
}
