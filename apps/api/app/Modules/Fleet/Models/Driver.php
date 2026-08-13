<?php

declare(strict_types=1);

namespace App\Modules\Fleet\Models;

use App\Modules\Agencies\Models\Agency;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Le chauffeur reste un acteur métier sans application dédiée (§3). Il peut en
 * revanche porter le rôle `AGENT` pour l'embarquement : le rôle est fonctionnel,
 * pas lié à un métier (B3).
 */
final class Driver extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'agency_id', 'first_name', 'last_name', 'phone',
        'license_number', 'license_expires_at', 'assigned_vehicle_id', 'status',
    ];

    /** @var array<string, string> */
    protected $casts = ['license_expires_at' => 'immutable_date'];

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /** @return BelongsTo<Vehicle, $this> */
    public function assignedVehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'assigned_vehicle_id');
    }

    public function fullName(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }
}
