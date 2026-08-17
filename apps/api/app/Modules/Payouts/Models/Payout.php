<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Models;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Identity\Models\User;
use App\Modules\Payouts\Enums\PayoutStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Reversement à une agence (B4).
 *
 * Le calcul est automatique, le **déclenchement est manuel**. Les premiers mois
 * produiront des cas non anticipés — remboursement arrivé en retard, réservation
 * contestée, coordonnées erronées — et un décaissement Mobile Money du mauvais
 * montant est quasi irréversible. La validation humaine reste le garde-fou tant
 * que le volume ne la rend pas impraticable.
 *
 * Cycle : DRAFT → PENDING_VALIDATION → APPROVED → PROCESSING → PAID | FAILED.
 */
final class Payout extends Model
{
    protected $fillable = [
        'reference', 'agency_id', 'payee_id', 'period_start', 'period_end',
        'gross_amount', 'commission_amount', 'refund_amount', 'adjustment_amount',
        'net_amount', 'currency', 'payout_account_id', 'status',
        'approved_by', 'approved_at', 'provider_reference', 'paid_at', 'failure_reason',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'status' => PayoutStatus::class,
        'period_start' => 'immutable_date',
        'period_end' => 'immutable_date',
        'approved_at' => 'immutable_datetime',
        'paid_at' => 'immutable_datetime',
    ];

    /**
     * Pont transitoire vers le bénéficiaire — voir `AgencyLedgerEntry`. À
     * retirer quand les appelants le passeront eux-mêmes.
     */
    protected static function booted(): void
    {
        self::creating(function (self $payout): void {
            // `agency_id` n'est pas nullable sur cette table : il y a
            // toujours une agence dont dériver le bénéficiaire.
            if ($payout->payee_id === null) {
                $payout->payee()->associate(Payee::forAgency($payout->agency_id));
            }
        });
    }

    /** @return BelongsTo<Payee, $this> */
    public function payee(): BelongsTo
    {
        return $this->belongsTo(Payee::class);
    }

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /** @return BelongsTo<PayoutAccount, $this> */
    public function account(): BelongsTo
    {
        return $this->belongsTo(PayoutAccount::class, 'payout_account_id');
    }

    /** @return BelongsTo<User, $this> */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Détail du relevé téléchargeable par l'agence — le document qui évite les
     * litiges répétés sur les montants.
     *
     * @return HasMany<PayoutLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(PayoutLine::class);
    }
}
