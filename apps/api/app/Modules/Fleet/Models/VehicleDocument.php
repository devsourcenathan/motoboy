<?php

declare(strict_types=1);

namespace App\Modules\Fleet\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class VehicleDocument extends Model
{
    protected $fillable = ['vehicle_id', 'type', 'file_path', 'expires_at'];

    /** @var array<string, string> */
    protected $casts = ['expires_at' => 'immutable_date'];

    /** @return BelongsTo<Vehicle, $this> */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }
}
