<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Console;

use App\Modules\Payouts\Actions\BuildDriverPayout;
use App\Modules\Payouts\Models\Payee;
use Illuminate\Console\Command;

/**
 * Construit les reversements dus aux chauffeurs.
 *
 * **Une commande, faute d'espace d'administration.** L'endpoint `POST
 * /v1/admin/payouts/build` ne balaie que les agences ; l'etendre aux chauffeurs
 * changerait la forme de sa reponse, et personne ne peut encore l'appeler puisque
 * le web n'existe pas. Cette commande donne le moyen de declencher et de verifier
 * des maintenant, comme `motoboy:approve-driver` pour la moderation.
 *
 * Elle **ne verse rien** : elle produit des propositions en attente de validation
 * humaine. Un decaissement Mobile Money du mauvais montant est quasi
 * irreversible.
 */
final class BuildDriverPayoutsCommand extends Command
{
    protected $signature = 'motoboy:build-driver-payouts {--phone= : Un seul chauffeur, par telephone}';

    protected $description = 'Prepare les reversements dus aux chauffeurs, en attente de validation';

    public function handle(BuildDriverPayout $build): int
    {
        $payees = Payee::query()
            ->where('kind', Payee::KIND_DRIVER)
            ->when(
                is_string($this->option('phone')),
                fn ($query) => $query->whereHas(
                    'user',
                    fn ($user) => $user->where('phone', $this->option('phone')),
                ),
            )
            ->get();

        if ($payees->isEmpty()) {
            $this->warn('Aucun chauffeur beneficiaire. Un beneficiaire naitrait au premier reglement de course.');

            return self::SUCCESS;
        }

        $built = 0;

        foreach ($payees as $payee) {
            $result = $build->handle($payee);
            $payout = $result['payout'];

            if ($payout === null) {
                // Les motifs sont dits, pas tus : « rien a verser » et « compte non
                // verifie » demandent deux actions tres differentes.
                $this->line(sprintf(
                    '  beneficiaire %d — %s (solde %d)',
                    $payee->id,
                    (string) $result['reason'],
                    $result['balance'],
                ));

                continue;
            }

            $built++;
            $this->info(sprintf(
                '  %s — %d %s, en attente de validation',
                $payout->reference,
                (int) $payout->net_amount,
                (string) $payout->currency,
            ));
        }

        $this->newLine();
        $this->info("{$built} reversement(s) prepare(s) sur {$payees->count()} chauffeur(s).");
        $this->comment('Rien n\'est verse : la validation reste humaine.');

        return self::SUCCESS;
    }
}
