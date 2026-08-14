<?php

declare(strict_types=1);

namespace App\Modules\Identity\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** Validité 10 minutes, 4 tentatives au maximum (§8). */
final class OtpCode extends Model
{
    public const MAX_ATTEMPTS = 4;

    public const LIFETIME_MINUTES = 10;

    public $timestamps = false;

    protected $fillable = ['phone', 'code_hash', 'purpose', 'expires_at', 'attempts', 'consumed_at', 'created_at'];

    /** @var array<string, string> */
    protected $casts = [
        'expires_at' => 'immutable_datetime',
        'consumed_at' => 'immutable_datetime',
        'created_at' => 'immutable_datetime',
    ];

    /** @param Builder<$this> $query */
    public function scopeUsable(Builder $query): void
    {
        $query->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->where('attempts', '<', self::MAX_ATTEMPTS);
    }
}
