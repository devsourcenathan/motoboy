<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Models;

use App\Modules\Identity\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Coordonnées de reversement.
 *
 * Le changement de ces coordonnées est un vecteur de fraude classique —
 * compromission du compte agence, modification du numéro, attente du jour de
 * paie. Toute création ou modification passe par l'administration, est
 * journalisée et notifiée à l'agence (B4).
 */
final class AgencyPayoutAccount extends Model
{
    protected $fillable = [
        'agency_id', 'type', 'operator', 'account_number', 'account_name',
        'verified_by', 'verified_at', 'is_active',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'verified_at' => 'immutable_datetime',
        'is_active' => 'boolean',
    ];

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /** @return BelongsTo<User, $this> */
    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    /**
     * La vérification est **obligatoire avant tout décaissement** : une erreur
     * de saisie envoie l'argent à un inconnu, sans recours.
     *
     * @param Builder<$this> $query
     */
    public function scopePayable(Builder $query): void
    {
        $query->where('is_active', true)->whereNotNull('verified_at');
    }
}
