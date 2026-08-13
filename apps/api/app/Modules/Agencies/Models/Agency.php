<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Models;

use App\Modules\Fleet\Models\Driver;
use App\Modules\Fleet\Models\Vehicle;
use App\Modules\Identity\Enums\Locale;
use App\Modules\Places\Models\Station;
use App\Modules\Routing\Models\Route;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Agency extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'reference', 'name', 'legal_name', 'phone', 'email',
        'logo_path', 'default_locale', 'status', 'approved_by', 'approved_at',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'default_locale' => Locale::class,
        'approved_at' => 'immutable_datetime',
    ];

    /**
     * Contrat commercial (B4) : défini par l'administration, consultable par
     * l'agence, jamais modifiable en libre-service.
     *
     * @return HasOne<AgencyCommercialTerms, $this>
     */
    public function commercialTerms(): HasOne
    {
        return $this->hasOne(AgencyCommercialTerms::class);
    }

    /** @return HasMany<AgencyPayoutAccount, $this> */
    public function payoutAccounts(): HasMany
    {
        return $this->hasMany(AgencyPayoutAccount::class);
    }

    /** @return HasMany<AgencyDocument, $this> */
    public function documents(): HasMany
    {
        return $this->hasMany(AgencyDocument::class);
    }

    /** @return HasMany<Station, $this> */
    public function stations(): HasMany
    {
        return $this->hasMany(Station::class);
    }

    /** @return HasMany<Vehicle, $this> */
    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    /** @return HasMany<Driver, $this> */
    public function drivers(): HasMany
    {
        return $this->hasMany(Driver::class);
    }

    /** @return HasMany<Route, $this> */
    public function routes(): HasMany
    {
        return $this->hasMany(Route::class);
    }

    /** @param Builder<$this> $query */
    public function scopeApproved(Builder $query): void
    {
        $query->where('status', 'APPROVED');
    }
}
