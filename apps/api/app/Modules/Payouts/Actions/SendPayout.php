<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Actions;

use App\Modules\Payouts\Contracts\PayoutGateway;
use App\Modules\Payouts\Data\DisbursementIntent;
use App\Modules\Payouts\Enums\LedgerEntryType;
use App\Modules\Payouts\Enums\PayoutStatus;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Payout;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Envoie le décaissement au prestataire.
 *
 * **Le débit au compte courant est écrit à l'envoi, pas à la confirmation.**
 * Sans cela, un reversement construit pendant que celui-ci est en vol verrait un
 * solde encore entier et paierait une seconde fois. Un échec le contre-passe :
 * le compte courant se corrige par écriture inverse, jamais par suppression.
 */
final class SendPayout
{
    public function __construct(private readonly PayoutGateway $gateway) {}

    public function handle(Payout $payout, string $idempotencyKey): Payout
    {
        if ($payout->status !== PayoutStatus::Approved) {
            throw ApiException::of(
                ErrorCode::PayoutNotSendable,
                'Ce reversement doit être approuvé avant d\'être envoyé.',
                ['status' => $payout->status->value],
            );
        }

        $account = $payout->account;

        // Une erreur de saisie envoie l'argent à un inconnu, sans recours. Le
        // changement de coordonnées est par ailleurs un vecteur de fraude
        // classique — compromission du compte, modification du numéro, attente
        // du jour de paie (B4).
        if ($account === null || $account->verified_at === null) {
            throw ApiException::of(
                ErrorCode::PayoutAccountUnverified,
                'Coordonnées de reversement non vérifiées.',
            );
        }

        DB::transaction(function () use ($payout): void {
            $payout->update(['status' => PayoutStatus::Processing]);
            $this->debit($payout);
        });

        try {
            $result = $this->gateway->disburse(new DisbursementIntent(
                reference: $payout->reference,
                amount: $payout->net_amount,
                currency: $payout->currency,
                accountType: $account->type,
                operator: $account->operator,
                accountNumber: $account->account_number,
                accountName: $account->account_name,
                idempotencyKey: $idempotencyKey,
            ));
        } catch (Throwable $e) {
            $this->fail($payout, $e->getMessage());

            report($e);

            return $payout->refresh();
        }

        if ($result->status === PayoutStatus::Failed) {
            $this->fail($payout, $result->failureReason ?? 'Décaissement refusé.');

            return $payout->refresh();
        }

        $payout->update([
            'status' => $result->status,
            'provider_reference' => $result->providerReference,
            'paid_at' => $result->status === PayoutStatus::Paid ? now() : null,
        ]);

        return $payout->refresh();
    }

    private function debit(Payout $payout): void
    {
        AgencyLedgerEntry::query()->create([
            'agency_id' => $payout->agency_id,
            // Aucune réservation : un reversement solde le compte, il ne se
            // rapporte à aucun voyage en particulier. C'est ce qui le rend
            // reversable immédiatement plutôt qu'à l'échéance d'un départ.
            'booking_id' => null,
            'type' => LedgerEntryType::PayoutDebit,
            'amount' => -$payout->net_amount,
            'currency' => $payout->currency,
            'reference_type' => 'payout',
            'reference_id' => $payout->id,
            'description' => "Reversement {$payout->reference}",
            'occurred_at' => now(),
            'created_at' => now(),
        ]);
    }

    /**
     * Le débit écrit à l'envoi est contre-passé : sans cela, l'agence
     * apparaîtrait payée alors qu'elle ne l'est pas, et le solde reversé lui
     * serait retiré sans qu'elle l'ait jamais reçu.
     */
    private function fail(Payout $payout, string $reason): void
    {
        DB::transaction(function () use ($payout, $reason): void {
            $payout->update([
                'status' => PayoutStatus::Failed,
                'failure_reason' => mb_substr($reason, 0, 255),
            ]);

            AgencyLedgerEntry::query()->create([
                'agency_id' => $payout->agency_id,
                'booking_id' => null,
                'type' => LedgerEntryType::PayoutReversalCredit,
                'amount' => $payout->net_amount,
                'currency' => $payout->currency,
                'reference_type' => 'payout',
                'reference_id' => $payout->id,
                'description' => "Reversement {$payout->reference} en échec",
                'occurred_at' => now(),
                'created_at' => now(),
            ]);
        });
    }
}
