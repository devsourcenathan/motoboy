<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Conditions commerciales de l'agence (B4).
 *
 * ⚠️ **Aucun calcul financier ne doit lire ce modèle.** Les valeurs applicables
 * sont recopiées sur la réservation à sa création : sans ce figement, modifier
 * un taux réécrirait rétroactivement l'historique de toutes les réservations
 * passées, y compris celles déjà reversées et déjà justifiées à l'agence.
 *
 * Ce modèle sert à **lire** les conditions courantes au moment de créer une
 * réservation, et à rien d'autre.
 */
final class AgencyCommercialTerms extends Model
{
    protected $table = 'agency_commercial_terms';

    protected $fillable = [
        'agency_id',
        'commission_type', 'commission_value', 'fee_bearer',
        'payout_delay_hours', 'payout_frequency', 'payout_day', 'payout_minimum_amount',
        'counter_sale_commission_enabled', 'counter_sale_sms_enabled',
        'cancellation_deadline_hours', 'cancellation_fee_type', 'cancellation_fee_value',
        'hold_duration_minutes', 'online_sales_cutoff_minutes',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'counter_sale_commission_enabled' => 'boolean',
        'counter_sale_sms_enabled' => 'boolean',
    ];

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }
}
