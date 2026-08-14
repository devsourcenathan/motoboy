<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Actions;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Payouts\Models\Payout;
use Carbon\CarbonImmutable;

/**
 * Passe sur les agences dont la cadence de reversement est échue (B4).
 *
 * Hebdomadaire le lundi par défaut, ou mensuelle. Une cadence plus rapide
 * multiplie les frais de décaissement ; si elle est accordée, ces frais sont
 * portés par l'agence qui la demande.
 */
final class BuildDuePayouts
{
    public function __construct(private readonly BuildPayout $build) {}

    /**
     * @return array{created: list<Payout>, skipped: list<array{agency_id: int, reason: string, balance: int}>}
     */
    public function handle(?int $agencyId = null, bool $force = false): array
    {
        $agencies = Agency::query()
            ->where('status', 'APPROVED')
            ->when($agencyId !== null, fn ($query) => $query->whereKey($agencyId))
            ->with('commercialTerms')
            ->get();

        $created = [];
        $skipped = [];

        foreach ($agencies as $agency) {
            if (!$force && !$this->isDue($agency)) {
                continue;
            }

            $result = $this->build->handle($agency);

            if ($result['payout'] !== null) {
                $created[] = $result['payout'];

                continue;
            }

            // Ce qui est écarté est **dit**. Une omission silencieuse se lit
            // comme « rien à verser », ce qui n'est pas la même chose que « sous
            // le seuil » ou « coordonnées non vérifiées » — et ces deux-là
            // demandent une action, pas de la patience.
            $skipped[] = [
                'agency_id' => $agency->id,
                'reason' => (string) $result['reason'],
                'balance' => $result['balance'],
            ];
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    /**
     * Le jour de cadence est-il aujourd'hui ?
     *
     * Le job tourne tous les jours et ne retient que les agences échues : une
     * planification par agence multiplierait les tâches et n'ajouterait rien.
     */
    private function isDue(Agency $agency): bool
    {
        $terms = $agency->commercialTerms;

        if ($terms === null) {
            return false;
        }

        $today = CarbonImmutable::now(config('app.display_timezone'));

        return match ($terms->payout_frequency) {
            'MONTHLY' => $today->day === max(1, min(28, $terms->payout_day)),
            default => $today->dayOfWeekIso === max(1, min(7, $terms->payout_day)),
        };
    }
}
