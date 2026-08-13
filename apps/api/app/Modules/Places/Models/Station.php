<?php

declare(strict_types=1);

namespace App\Modules\Places\Models;

use App\Modules\Agencies\Models\Agency;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Une gare **appartient à une agence** (B1) : au Cameroun, les compagnies
 * interurbaines exploitent très majoritairement la leur. Deux agences installées
 * au même endroit produisent donc deux gares distinctes.
 */
final class Station extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'agency_id', 'city_id', 'name', 'address',
        'latitude', 'longitude', 'is_active', 'moderated_at',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'is_active' => 'boolean',
        'moderated_at' => 'immutable_datetime',
    ];

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /** @return BelongsTo<City, $this> */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    /** @param Builder<$this> $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }
}
