<?php

declare(strict_types=1);

namespace App\Modules\Administration\Models;

use App\Modules\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Journal des opérations sensibles (§28).
 *
 * À journaliser impérativement : création et modification d'un trajet,
 * modification d'un prix, annulation d'une réservation, validation d'un billet,
 * remboursement, approbation d'un reversement, **modification des coordonnées de
 * reversement**, modification des conditions commerciales, validation d'une
 * agence.
 *
 * Une entrée d'audit ne se modifie jamais : d'où l'absence de `updated_at`.
 */
final class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'action', 'auditable_type', 'auditable_id',
        'old_values', 'new_values', 'ip_address', 'user_agent', 'created_at',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'immutable_datetime',
    ];

    /**
     * Null pour une action système — libération des tenues expirées, génération
     * de départs, remboursement automatique.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return MorphTo<Model, $this> */
    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }
}
