<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Models;

use App\Modules\Identity\Models\User;
use App\Modules\Tickets\Enums\ValidationMethod;
use App\Modules\Trips\Models\Trip;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Validation à l'embarquement (B3).
 *
 * `validated_at` est l'horodatage **local à l'appareil** : l'agent peut être
 * hors ligne, et la validation n'est synchronisée qu'au retour du réseau.
 *
 * Il n'existe **aucune contrainte d'unicité sur `ticket_id`**. La double
 * validation hors ligne est un coût explicitement accepté : deux agents
 * disposant de la liste d'embarquement peuvent valider le même billet, et le
 * serveur la signale plutôt que de la bloquer — les deux relèvent de la même
 * agence. Rejeter le doublon ferait perdre l'information qui permet de le
 * diagnostiquer.
 */
final class TicketValidation extends Model
{
    protected $fillable = [
        'ticket_id', 'trip_id', 'validated_by', 'validated_at',
        'method', 'device_id', 'synced_at', 'is_duplicate',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'method' => ValidationMethod::class,
        'validated_at' => 'immutable_datetime',
        'synced_at' => 'immutable_datetime',
        'is_duplicate' => 'boolean',
    ];

    /** @return BelongsTo<Ticket, $this> */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    /** @return BelongsTo<Trip, $this> */
    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    /**
     * Porteur du rôle AGENT.
     *
     * @return BelongsTo<User, $this>
     */
    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }
}
