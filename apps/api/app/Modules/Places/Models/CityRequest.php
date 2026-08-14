<?php

declare(strict_types=1);

namespace App\Modules\Places\Models;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Demande d'ajout d'une ville absente du référentiel.
 *
 * Sans ce circuit, une agence desservant une ville manquante est bloquée sans
 * recours et abandonne (B1).
 */
final class CityRequest extends Model
{
    protected $fillable = [
        'agency_id', 'country_id', 'requested_name',
        'status', 'resolved_city_id', 'reviewed_by', 'reviewed_at',
    ];

    /** @var array<string, string> */
    protected $casts = ['reviewed_at' => 'immutable_datetime'];

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /** @return BelongsTo<City, $this> */
    public function resolvedCity(): BelongsTo
    {
        return $this->belongsTo(City::class, 'resolved_city_id');
    }

    /** @return BelongsTo<User, $this> */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
