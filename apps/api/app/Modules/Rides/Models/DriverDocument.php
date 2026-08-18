<?php

declare(strict_types=1);

namespace App\Modules\Rides\Models;

use App\Modules\Rides\Enums\DriverDocumentType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Une pièce du dossier.
 *
 * Le fichier n'est pas stocké ici : seul son chemin l'est, et le stockage passe
 * par le port `FileStorage`. Une pièce par type — redéposer une carte grise
 * remplace l'ancienne plutôt que de s'empiler à côté, sinon la modération ne
 * saurait pas laquelle fait foi.
 */
final class DriverDocument extends Model
{
    protected $fillable = ['driver_profile_id', 'type', 'file_path', 'expires_at'];

    /** @var array<string, string> */
    protected $casts = [
        'type' => DriverDocumentType::class,
        'expires_at' => 'immutable_date',
    ];

    /** @return BelongsTo<DriverProfile, $this> */
    public function profile(): BelongsTo
    {
        return $this->belongsTo(DriverProfile::class, 'driver_profile_id');
    }
}
