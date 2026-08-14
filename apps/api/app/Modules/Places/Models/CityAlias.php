<?php

declare(strict_types=1);

namespace App\Modules\Places\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Variante de saisie d'une ville.
 *
 * `normalized` porte la forme minuscule sans accent : sur un clavier de
 * téléphone, les accents ne sont pratiquement jamais saisis, et une
 * comparaison stricte échouerait sur une grande part des saisies réelles (B1).
 */
final class CityAlias extends Model
{
    protected $fillable = ['city_id', 'alias', 'normalized'];

    /** @return BelongsTo<City, $this> */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }
}
