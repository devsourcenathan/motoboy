<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Actions;

use App\Modules\Administration\Actions\RecordAudit;
use App\Modules\Agencies\Models\Agency;
use App\Modules\Agencies\Models\AgencyPayoutAccount;
use App\Modules\Identity\Enums\Locale;
use App\Modules\Notifications\Contracts\SmsSender;
use App\Modules\Notifications\Data\SmsMessage;
use App\Modules\Notifications\Models\Notification;
use Illuminate\Support\Facades\DB;

/**
 * Coordonnées de reversement (B4).
 *
 * **Le changement de coordonnées est un vecteur de fraude classique** :
 * compromission du compte agence, modification du numéro, attente du jour de
 * paie. Trois garde-fous, tous obligatoires :
 *
 * 1. jamais appliqué en libre-service — les nouvelles coordonnées naissent non
 *    vérifiées et n'encaissent rien tant qu'un administrateur ne les a pas
 *    vérifiées ;
 * 2. journalisé avec ancienne et nouvelle valeur ;
 * 3. notifié aux contacts connus de l'agence — c'est ce qui permet au dirigeant
 *    légitime de réagir quand ce n'est pas lui qui a demandé le changement.
 */
final class ManagePayoutAccount
{
    public function __construct(
        private readonly RecordAudit $audit,
        private readonly SmsSender $sms,
    ) {}

    public function submit(
        Agency $agency,
        string $type,
        ?string $operator,
        string $accountNumber,
        string $accountName,
        ?int $submittedBy,
    ): AgencyPayoutAccount {
        $current = $agency->payoutAccounts()->where('is_active', true)->first();

        $account = DB::transaction(function () use (
            $agency, $type, $operator, $accountNumber, $accountName, $submittedBy, $current,
        ): AgencyPayoutAccount {
            $account = $agency->payoutAccounts()->create([
                'type' => $type,
                'operator' => $operator,
                'account_number' => $accountNumber,
                'account_name' => $accountName,
                // Les précédentes restent actives jusqu'à la vérification :
                // désactiver tout de suite priverait l'agence d'un reversement
                // en cours sur la foi d'une saisie non contrôlée.
                'is_active' => false,
                'verified_at' => null,
            ]);

            $this->audit->handle(
                action: 'payout_account.submitted',
                subject: $account,
                userId: $submittedBy,
                old: $current === null ? null : ['masked' => self::mask($current->account_number)],
                new: ['masked' => self::mask($accountNumber), 'type' => $type],
            );

            return $account;
        });

        $this->warn($agency);

        return $account;
    }

    /**
     * Le geste qui autorise l'argent à partir.
     *
     * Vérifier de nouvelles coordonnées **désactive les précédentes** : une
     * agence n'a qu'un compte actif, et en laisser deux rendrait le choix
     * implicite au moment du versement.
     */
    public function verify(AgencyPayoutAccount $account, int $verifierId): AgencyPayoutAccount
    {
        DB::transaction(function () use ($account, $verifierId): void {
            AgencyPayoutAccount::query()
                ->where('agency_id', $account->agency_id)
                ->whereKeyNot($account->id)
                ->update(['is_active' => false]);

            $account->update([
                'is_active' => true,
                'verified_at' => now(),
                'verified_by' => $verifierId,
            ]);

            $this->audit->handle(
                action: 'payout_account.verified',
                subject: $account,
                userId: $verifierId,
                new: ['masked' => self::mask($account->account_number)],
            );
        });

        return $account->refresh();
    }

    /**
     * Prévient l'agence sur le contact qu'elle avait **avant** la demande.
     *
     * Envoyer sur le nouveau numéro n'avertirait que l'auteur du changement —
     * c'est-à-dire l'attaquant, dans le seul scénario qui compte.
     */
    private function warn(Agency $agency): void
    {
        $phone = $agency->phone;

        if (trim($phone) === '') {
            return;
        }

        $locale = $agency->default_locale ?? Locale::French;

        $body = trans('sms.payout_account_changed', [], $locale->value);

        $result = $this->sms->send(new SmsMessage(
            to: $phone,
            body: is_string($body) ? $body : '',
            locale: $locale,
            type: 'PAYOUT_ACCOUNT_CHANGED',
        ));

        Notification::query()->create([
            'phone' => $phone,
            'channel' => 'SMS',
            'locale' => $locale,
            'type' => 'PAYOUT_ACCOUNT_CHANGED',
            'payload' => ['agency_reference' => $agency->reference],
            'status' => $result->delivered ? 'SENT' : 'FAILED',
            'provider_reference' => $result->providerReference,
            'sent_at' => $result->delivered ? now() : null,
            'error' => $result->error,
        ]);
    }

    private static function mask(string $number): string
    {
        return str_repeat('•', max(0, mb_strlen($number) - 3)).mb_substr($number, -3);
    }
}
