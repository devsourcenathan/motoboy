<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Http\Resources;

use App\Modules\Payouts\Models\Payee;
use App\Modules\Payouts\Models\Payout;
use App\Modules\Payouts\Models\PayoutAccount;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Payout
 */
final class PayoutResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'reference' => $this->reference,
            'agency_id' => $this->agency_id,
            /*
             * **À qui, et où.**
             *
             * La ressource n'exposait que `agency_id` — nul pour un chauffeur
             * indépendant. Un administrateur sur le point de valider un
             * décaissement voyait donc un montant sans savoir à qui il partait,
             * ni vers quel numéro. C'est la seule information qu'il ne peut pas
             * deviner, et la seule dont une erreur est irréversible : un virement
             * Mobile Money mal dirigé ne se récupère pas.
             */
            'payee' => $this->payeeSummary(),
            'destination' => $this->destination(),
            'period_start' => $this->period_start->toDateString(),
            'period_end' => $this->period_end->toDateString(),
            'status' => $this->status,
            'gross' => $this->money($this->gross_amount),
            'commission' => $this->money($this->commission_amount),
            'refunds' => $this->money($this->refund_amount),
            'adjustments' => $this->money($this->adjustment_amount),
            'net' => $this->money($this->net_amount),
            'approved_at' => $this->approved_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'provider_reference' => $this->provider_reference,
            'failure_reason' => $this->failure_reason,
        ];
    }

    /**
     * Le bénéficiaire, agence ou personne.
     *
     * `loadMissing` plutôt qu'un chargement supposé : `shouldBeStrict()` interdit
     * le chargement paresseux, et une ressource ne doit pas dépendre de ce que
     * l'appelant a pensé à charger. Les listes chargent en amont, sans quoi ce
     * serait une requête par ligne.
     *
     * @return array{kind: string|null, name: string|null, phone: string|null}
     */
    private function payeeSummary(): array
    {
        $payee = $this->loadMissing('payee.agency', 'payee.user')->payee;

        if ($payee === null) {
            return ['kind' => null, 'name' => null, 'phone' => null];
        }

        if ($payee->kind === Payee::KIND_AGENCY) {
            return [
                'kind' => $payee->kind,
                'name' => $payee->agency?->name,
                'phone' => $payee->agency?->phone,
            ];
        }

        $user = $payee->user;

        return [
            'kind' => $payee->kind,
            'name' => $user?->fullName(),
            'phone' => $user?->phone,
        ];
    }

    /**
     * La destination du virement.
     *
     * Numéro **tronqué**, comme partout ailleurs : celui qui valide compare les
     * trois derniers chiffres et le nom du compte, ce qui suffit à reconnaître
     * une erreur. Le numéro complet n'a pas à circuler dans une réponse d'API,
     * fût-elle réservée à l'administration — il finirait dans un journal.
     *
     * @return array{operator: string|null, account_name: string|null, masked_number: string|null, verified: bool}|null
     */
    private function destination(): ?array
    {
        $account = $this->loadMissing('account')->account;

        if (!$account instanceof PayoutAccount) {
            return null;
        }

        return [
            'operator' => $account->operator,
            'account_name' => $account->account_name,
            'masked_number' => str_repeat('•', max(0, mb_strlen($account->account_number) - 3))
                .mb_substr($account->account_number, -3),
            'verified' => $account->verified_at !== null,
        ];
    }

    /** @return array{amount: int, currency: string} */
    private function money(int $amount): array
    {
        return ['amount' => $amount, 'currency' => $this->currency];
    }
}
