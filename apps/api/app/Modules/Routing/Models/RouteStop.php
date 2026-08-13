<?php

declare(strict_types=1);

namespace App\Modules\Routing\Models;

use App\Modules\Places\Models\City;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Escale informative — aucune incidence sur l'inventaire (B6). */
final class RouteStop extends Model
{
    protected $fillable = ['route_id', 'city_id', 'position'];

    /** @return BelongsTo<Route, $this> */
    public function route(): BelongsTo
    {
        return $this->belongsTo(Route::class);
    }

    /** @return BelongsTo<City, $this> */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }
}
