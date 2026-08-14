<?php

declare(strict_types=1);

namespace App\Modules\Payments\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Journal traçable des webhooks (I7).
 *
 * Sans lui, un paiement perdu est indébogable. Il complète la réconciliation
 * quotidienne de B4 : la réconciliation détecte l'écart, le journal explique son
 * origine.
 *
 * L'unicité sur le couple fournisseur / identifiant d'événement porte
 * l'idempotence du rejeu — les prestataires réémettent.
 */
final class PaymentWebhook extends Model
{
    protected $fillable = [
        'provider', 'event_id', 'payload', 'signature_valid',
        'received_at', 'processed_at', 'status', 'error',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'payload' => 'array',
        'signature_valid' => 'boolean',
        'received_at' => 'immutable_datetime',
        'processed_at' => 'immutable_datetime',
    ];
}
