<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Models;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Bookings\Models\Booking;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Commission d'une réservation.
 *
 * `type` et `value` sont recopiés depuis la réservation, elle-même figée à sa
 * création : aucun calcul ne lit les conditions courantes de l'agence (B4).
 *
 * Sur une annulation, la commission n'est **pas prélevée** : MOTOBOY récupère
 * uniquement ses frais réels d'agrégateur sur les frais d'annulation retenus, le
 * solde revenant à l'agence, qui subit la perte réelle du siège. Si les frais
 * retenus sont inférieurs aux frais réels, MOTOBOY absorbe la différence — sans
 * quoi le calcul produirait un montant négatif à réclamer à l'agence pour
 * quelques dizaines de francs (B5).
 */
final class Commission extends Model
{
    protected $fillable = [
        'booking_id', 'agency_id', 'base_amount',
        'type', 'value', 'amount', 'aggregator_fee_amount',
        'status', 'reversed_at',
    ];

    /** @var array<string, string> */
    protected $casts = ['reversed_at' => 'immutable_datetime'];

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }
}
