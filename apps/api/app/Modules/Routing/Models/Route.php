<?php

declare(strict_types=1);

namespace App\Modules\Routing\Models;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Places\Models\City;
use App\Modules\Places\Models\Station;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Itinéraire, **jamais daté** — un `Trip` l'est toujours (annexe A du brief).
 *
 * Les gares sont portées ici et surchargeables sur un départ : une agence part
 * de sa gare habituelle, l'exception reste une exception, et ce rattachement
 * évite de réinscrire la gare sur chaque départ généré (I1).
 */
final class Route extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'agency_id', 'origin_city_id', 'destination_city_id',
        'origin_station_id', 'destination_station_id',
        'reference_duration_minutes', 'is_active',
    ];

    /** @var array<string, string> */
    protected $casts = ['is_active' => 'boolean'];

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
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

    /** @return BelongsTo<Station, $this> */
    public function originStation(): BelongsTo
    {
        return $this->belongsTo(Station::class, 'origin_station_id');
    }

    /** @return BelongsTo<Station, $this> */
    public function destinationStation(): BelongsTo
    {
        return $this->belongsTo(Station::class, 'destination_station_id');
    }

    /**
     * Escales **purement informatives** : la réservation est point-à-point
     * uniquement, et une ville d'escale ne rend pas ce trajet éligible à une
     * recherche qui la viserait (B6).
     *
     * @return HasMany<RouteStop, $this>
     */
    public function stops(): HasMany
    {
        return $this->hasMany(RouteStop::class)->orderBy('position');
    }

    /** @return HasMany<Schedule, $this> */
    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class);
    }
}
