<?php

declare(strict_types=1);

namespace App\Modules\Places\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class City extends Model
{
    protected $fillable = ['country_id', 'name', 'slug', 'is_active'];

    /** @var array<string, string> */
    protected $casts = ['is_active' => 'boolean'];

    /** @return BelongsTo<Country, $this> */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Variantes de saisie. Sans elles, l'autocomplétion échoue sur les saisies
     * sans accent — c'est-à-dire la plupart (B1).
     *
     * @return HasMany<CityAlias, $this>
     */
    public function aliases(): HasMany
    {
        return $this->hasMany(CityAlias::class);
    }

    /** @return HasMany<Station, $this> */
    public function stations(): HasMany
    {
        return $this->hasMany(Station::class);
    }
}
