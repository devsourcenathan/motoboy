<?php

declare(strict_types=1);

namespace App\Modules\Routing\Models;

use App\Modules\Fleet\Models\Driver;
use App\Modules\Fleet\Models\Vehicle;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Horaire récurrent (I1).
 *
 * Distinct de la route parce qu'une même liaison porte souvent plusieurs départs
 * de nature différente : un VIP à 08:00 et un classique à 14:00 n'ont ni le même
 * véhicule ni le même tarif.
 *
 * Modifier un horaire **n'affecte pas les départs déjà générés** : le changement
 * s'applique aux trajets créés ensuite. Même principe de figement qu'en B4 et B5.
 */
final class Schedule extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'route_id', 'departure_time', 'days_of_week',
        'default_vehicle_id', 'default_driver_id',
        'price', 'currency', 'valid_from', 'valid_until', 'is_active',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'days_of_week' => 'array',
        'valid_from' => 'immutable_date',
        'valid_until' => 'immutable_date',
        'is_active' => 'boolean',
    ];

    /** @return BelongsTo<Route, $this> */
    public function route(): BelongsTo
    {
        return $this->belongsTo(Route::class);
    }

    /** @return BelongsTo<Vehicle, $this> */
    public function defaultVehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'default_vehicle_id');
    }

    /** @return BelongsTo<Driver, $this> */
    public function defaultDriver(): BelongsTo
    {
        return $this->belongsTo(Driver::class, 'default_driver_id');
    }

    /** @param Builder<$this> $query */
    public function scopeGeneratable(Builder $query): void
    {
        $query->where('is_active', true)
            /*
             * **L'itinéraire compte autant que l'horaire.**
             *
             * `routes.is_active` existait et n'était filtré nulle part : fermer
             * une ligne entière ne l'empêchait pas de produire des départs, et
             * il fallait arrêter ses horaires un par un — en en oubliant un.
             * La colonne promettait quelque chose que rien ne tenait.
             */
            ->whereHas('route', fn (Builder $route) => $route->where('is_active', true))
            ->where('valid_from', '<=', now())
            ->where(fn (Builder $q) => $q->whereNull('valid_until')->orWhere('valid_until', '>=', now()));
    }
}
