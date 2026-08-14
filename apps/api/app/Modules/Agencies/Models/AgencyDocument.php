<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class AgencyDocument extends Model
{
    protected $fillable = ['agency_id', 'type', 'file_path', 'status', 'expires_at'];

    /** @var array<string, string> */
    protected $casts = ['expires_at' => 'immutable_date'];

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }
}
