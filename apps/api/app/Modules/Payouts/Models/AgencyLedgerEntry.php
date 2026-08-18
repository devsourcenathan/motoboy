<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Models;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Identity\Models\User;
use App\Modules\Payouts\Enums\LedgerEntryType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Écriture du compte courant d'une agence (B4).
 *
 * Le compte courant a été préféré à un calcul par période parce qu'il absorbe
 * naturellement les soldes négatifs, les régularisations tardives et les
 * corrections manuelles.
 *
 * **Aucun solde n'est stocké** : il se calcule par somme. Un solde dénormalisé
 * finit toujours par diverger de ses écritures, et sur un compte qui détermine
 * combien l'on verse à une agence, la divergence se découvre lors d'une
 * réclamation.
 *
 * Les écritures sont **immuables** : une erreur se corrige par une écriture
 * inverse, jamais par une modification. D'où l'absence de `updated_at`.
 */
final class AgencyLedgerEntry extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'agency_id', 'payee_id', 'booking_id', 'type', 'amount', 'currency',
        'reference_type', 'reference_id', 'description', 'created_by', 'occurred_at', 'created_at',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'type' => LedgerEntryType::class,
        'occurred_at' => 'immutable_datetime',
        'created_at' => 'immutable_datetime',
    ];

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

    /**
     * Null pour ce qui ne concerne aucune réservation — ajustement manuel,
     * reversement, contre-passation. C'est précisément ce qui est reversable
     * sans attendre qu'un départ soit parti (B4).
     *
     * @return BelongsTo<Booking, $this>
     */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
