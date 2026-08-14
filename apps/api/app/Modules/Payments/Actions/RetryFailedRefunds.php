<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Payments\Enums\RefundStatus;
use App\Modules\Payments\Models\Refund;
use Illuminate\Support\Facades\Log;

/**
 * Rejoue les remboursements en échec (B5).
 *
 * **Le pire état possible pour un passager : sans argent et sans billet.** Un
 * remboursement en échec ne doit jamais rester silencieux — il est rejoué
 * automatiquement, puis remonté en alerte s'il échoue encore.
 *
 * L'espace d'administration n'existe pas encore : « alerte » veut donc dire un
 * état durable et interrogeable — `FAILED` avec `retry_count` au plafond — plus
 * une trace journalisée. C'est ce qu'un écran affichera le jour venu ; ce n'est
 * pas ce qui doit attendre l'écran pour exister.
 */
final class RetryFailedRefunds
{
    /**
     * Trois tentatives.
     *
     * Au-delà, l'échec n'est plus transitoire : c'est le compte source qui pose
     * problème, et réessayer indéfiniment ne ferait que retarder l'intervention
     * humaine tout en noyant le journal.
     */
    public const MAX_ATTEMPTS = 3;

    public function __construct(private readonly RefundPayment $refunds) {}

    /** @return int Remboursements repris. */
    public function handle(): int
    {
        $failed = Refund::query()
            ->needingRetry()
            ->where('retry_count', '<', self::MAX_ATTEMPTS)
            ->with('payment')
            ->limit(100)
            ->get();

        $retried = 0;

        foreach ($failed as $refund) {
            // Incrémenté **avant** la tentative : si l'appel part et que le
            // processus meurt, le compteur a déjà bougé. Sans cela, une panne
            // rejouerait à l'infini le même remboursement.
            $refund->increment('retry_count');

            $this->refunds->execute($refund->refresh());

            $retried++;
        }

        $this->alertOnExhausted();

        return $retried;
    }

    private function alertOnExhausted(): void
    {
        $exhausted = Refund::query()
            ->where('status', RefundStatus::Failed)
            ->where('retry_count', '>=', self::MAX_ATTEMPTS)
            ->pluck('reference')
            ->all();

        if ($exhausted === []) {
            return;
        }

        Log::error('Remboursements en échec après épuisement des tentatives', [
            'references' => $exhausted,
            'action' => 'Intervention manuelle requise : le passager est sans argent et sans billet.',
        ]);
    }
}
