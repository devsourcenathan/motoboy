<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Support;

use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Rides\Models\Ride;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Ce qui est reversable a un chauffeur aujourd'hui.
 *
 * Le pendant d'`EligibleBalance` pour les courses. Une reservation devient
 * eligible quand son **depart** est parti ; une course, quand elle est
 * **terminee** depuis assez longtemps. Il n'y a pas de depart programme a
 * attendre : c'est la fin de course qui fait foi.
 *
 * Toutes les ecritures d'une course entrent **ensemble** — le credit et la
 * commission. Les prendre separement reverserait le brut d'une course dont la
 * commission n'est pas encore eligible, donc plus que ce qui est du.
 *
 * Les ecritures sans course — ajustement manuel, reversement, contre-passation —
 * sont eligibles immediatement : un administrateur les a ecrites deliberement, et
 * les retenir jusqu'a une course qu'elles ne concernent pas les laisserait en
 * suspens sans fin.
 */
final class EligibleRideBalance
{
    /**
     * @return Builder<AgencyLedgerEntry>
     */
    public static function query(int $payeeId, int $delayHours): Builder
    {
        return AgencyLedgerEntry::query()
            ->where('payee_id', $payeeId)
            ->where(function (Builder $query) use ($delayHours): void {
                $query
                    ->where('reference_type', '!=', Ride::class)
                    ->orWhereNull('reference_type')
                    ->orWhereIn('reference_id', self::settledRides($delayHours));
            });
    }

    public static function amount(int $payeeId, int $delayHours): int
    {
        return (int) self::query($payeeId, $delayHours)->sum('amount');
    }

    /**
     * Courses terminees depuis assez longtemps.
     *
     * `completed_at` et non `status` : une course annulee apres coup garde son
     * horodatage, et c'est le grand livre — credit puis remboursement — qui porte
     * le solde reel. Filtrer sur le statut ferait disparaitre la course et son
     * remboursement avec elle.
     */
    private static function settledRides(int $delayHours): \Illuminate\Database\Query\Builder
    {
        return DB::table('rides')
            ->select('rides.id')
            ->whereNotNull('rides.completed_at')
            ->where('rides.completed_at', '<=', now()->subHours($delayHours));
    }
}
