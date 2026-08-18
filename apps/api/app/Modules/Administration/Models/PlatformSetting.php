<?php

declare(strict_types=1);

namespace App\Modules\Administration\Models;

use App\Modules\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un reglage de plateforme, modifiable depuis le dashboard.
 *
 * Volontairement sans accesseur generique : chaque reglage passe par un point
 * typé qui connait ses bornes (voir `RideCommission`). Un `Setting::get('x')`
 * ouvert laisserait lire n'importe quoi sans savoir ce que vaut « n'importe
 * quoi » — et un taux de commission mal borné prend tout.
 */
final class PlatformSetting extends Model
{
    protected $fillable = ['key', 'value', 'updated_by'];

    /** @return BelongsTo<User, $this> */
    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
