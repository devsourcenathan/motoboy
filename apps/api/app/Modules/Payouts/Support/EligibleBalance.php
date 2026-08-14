<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Support;

use App\Modules\Payouts\Models\AgencyLedgerEntry;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Ce qui est reversable aujourd'hui, et rien d'autre.
 *
 * **Une réservation devient éligible quand son départ est parti et que le délai
 * configuré est écoulé** (B4). Reverser avant le départ est la seule
 * configuration qui crée une créance irrécupérable : un remboursement survenant
 * après un versement Mobile Money ne se récupère pas par une procédure, mais par
 * la bonne volonté de l'agence.
 *
 * Toutes les écritures rattachées à une réservation entrent **ensemble** — le
 * crédit, la commission, le remboursement, la contre-passation. Les prendre
 * séparément verserait le brut d'une réservation dont le remboursement n'est pas
 * encore éligible.
 *
 * Les écritures sans réservation — ajustement manuel, reversement,
 * contre-passation de reversement — sont éligibles immédiatement : un
 * administrateur les a écrites délibérément, et les retenir jusqu'à un départ
 * qu'elles ne concernent pas les laisserait en suspens sans fin.
 */
final class EligibleBalance
{
    /**
     * Le délai vient des **conditions courantes de l'agence**, pas de la
     * réservation : c'est une cadence de versement, pas une condition figée à
     * l'achat comme la commission. Une renégociation s'applique donc au prochain
     * versement, ce qui est l'effet voulu.
     *
     * @return Builder<AgencyLedgerEntry>
     */
    public static function query(int $agencyId, int $delayHours): Builder
    {
        return AgencyLedgerEntry::query()
            ->where('agency_id', $agencyId)
            ->where(function (Builder $query) use ($delayHours): void {
                $query
                    ->whereNull('booking_id')
                    ->orWhereIn('booking_id', self::departedBookings($delayHours));
            });
    }

    public static function amount(int $agencyId, int $delayHours): int
    {
        return (int) self::query($agencyId, $delayHours)->sum('amount');
    }

    /**
     * Réservations dont le départ est parti depuis assez longtemps.
     */
    private static function departedBookings(int $delayHours): \Illuminate\Database\Query\Builder
    {
        return DB::table('bookings')
            ->select('bookings.id')
            ->join('trips', 'trips.id', '=', 'bookings.trip_id')
            ->where('trips.departure_at', '<=', now()->subHours($delayHours));
    }
}
