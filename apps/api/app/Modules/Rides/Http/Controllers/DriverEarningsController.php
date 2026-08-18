<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Controllers;

use App\Modules\Administration\Support\RidePayoutTerms;
use App\Modules\Agencies\Actions\ManagePayoutAccount;
use App\Modules\Identity\Models\User;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Payee;
use App\Modules\Payouts\Models\Payout;
use App\Modules\Payouts\Models\PayoutAccount;
use App\Modules\Payouts\Support\EligibleRideBalance;
use App\Modules\Rides\Models\DriverProfile;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Son argent (C8, C9).
 *
 * **Trois nombres, pas un.** Un solde seul transforme chaque question en
 * reclamation : le chauffeur doit lire ce qu'il a gagne, ce qui a ete preleve, et
 * ce qui est deja parti. C'est la meme raison qui fait ecrire le credit et la
 * commission separement au grand livre.
 *
 * Le **reversable** se distingue du solde : une course terminee il y a une heure
 * compte dans le solde mais n'est pas encore versable. Confondre les deux ferait
 * attendre un virement qui ne peut pas encore partir.
 */
final class DriverEarningsController
{
    public function __construct(private readonly RidePayoutTerms $terms) {}

    public function earnings(Request $request): JsonResponse
    {
        $payee = $this->payee($request);
        $delay = $this->terms->delayHours();

        $entries = AgencyLedgerEntry::query()
            ->where('payee_id', $payee->id)
            ->orderByDesc('occurred_at')
            ->limit(50)
            ->get();

        $balance = (int) AgencyLedgerEntry::query()->where('payee_id', $payee->id)->sum('amount');
        $eligible = EligibleRideBalance::amount($payee->id, $delay);

        /*
         * La devise vient du grand livre lui-meme, non de la premiere des
         * cinquante lignes affichees : la faire dependre de la page rendrait le
         * total muet le jour ou la liste est vide alors que le solde ne l'est pas.
         */
        $currency = AgencyLedgerEntry::query()->where('payee_id', $payee->id)->value('currency');
        $currency = is_string($currency) ? $currency : 'XAF';

        return response()->json([
            'balance' => ['amount' => $balance, 'currency' => $currency],
            'payable' => ['amount' => max(0, $eligible), 'currency' => $currency],
            'minimum' => ['amount' => $this->terms->minimumAmount(), 'currency' => $currency],
            'delay_hours' => $delay,
            'entries' => $entries->map(fn (AgencyLedgerEntry $entry) => [
                'type' => $entry->type->value,
                'amount' => ['amount' => (int) $entry->amount, 'currency' => (string) $entry->currency],
                'description' => $entry->description,
                'occurred_at' => $entry->occurred_at?->toAtomString(),
            ])->all(),
            'payouts' => Payout::query()
                ->where('payee_id', $payee->id)
                ->orderByDesc('id')
                ->limit(20)
                ->get()
                ->map(fn (Payout $payout) => [
                    'reference' => $payout->reference,
                    'status' => $payout->status->value,
                    'net_amount' => ['amount' => (int) $payout->net_amount, 'currency' => (string) $payout->currency],
                    'paid_at' => $payout->paid_at?->toAtomString(),
                ])->all(),
        ]);
    }

    public function payoutAccounts(Request $request): JsonResponse
    {
        $payee = $this->payee($request);

        return response()->json([
            'data' => PayoutAccount::query()
                ->where('payee_id', $payee->id)
                ->orderByDesc('created_at')
                ->get()
                ->map($this->account(...))
                ->all(),
        ]);
    }

    public function submitPayoutAccount(Request $request, ManagePayoutAccount $accounts): JsonResponse
    {
        $payee = $this->payee($request);

        $validated = $request->validate([
            // Mobile Money seul : un chauffeur independant n'a pas de compte
            // d'entreprise, et proposer « virement bancaire » ferait saisir des
            // coordonnees qu'on ne saurait pas verifier.
            'type' => ['required', 'string', 'in:MOBILE_MONEY'],
            'operator' => ['required', 'string', 'in:MTN,ORANGE'],
            'account_number' => ['required', 'string', 'max:50'],
            'account_name' => ['required', 'string', 'max:150'],
        ]);

        $user = $request->user();

        $account = $accounts->submitForPayee(
            payee: $payee,
            type: (string) $validated['type'],
            operator: (string) $validated['operator'],
            accountNumber: (string) $validated['account_number'],
            accountName: (string) $validated['account_name'],
            submittedBy: $user instanceof User ? $user->id : null,
        );

        return response()->json($this->account($account), 201);
    }

    /** @return array<string, mixed> */
    private function account(PayoutAccount $account): array
    {
        return [
            'id' => $account->id,
            'type' => $account->type,
            'operator' => $account->operator,
            'account_name' => $account->account_name,
            // Meme tronquage que partout ailleurs : le numero complet n'a pas a
            // circuler dans une reponse d'API, meme vers son proprietaire.
            'masked_number' => str_repeat('•', max(0, mb_strlen($account->account_number) - 3))
                .mb_substr($account->account_number, -3),
            'verified' => $account->verified_at !== null,
        ];
    }

    /**
     * Le beneficiaire du chauffeur, cree a la demande.
     *
     * Il n'existe qu'au premier reglement de course : un chauffeur qui veut
     * renseigner son compte avant sa premiere course n'en aurait donc aucun, et
     * l'ecran echouerait sur une condition qui n'a rien de fautif.
     */
    private function payee(Request $request): Payee
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session absente.');
        }

        $driver = DriverProfile::query()->where('user_id', $user->id)->first();

        if ($driver === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Aucun dossier de chauffeur.');
        }

        // La meme fabrique que le reglement de course, et non un `firstOrCreate`
        // parallele : deux chemins de creation finiraient par diverger, et un
        // chauffeur se retrouverait avec deux beneficiaires donc deux soldes.
        return Payee::forUser($user->id);
    }
}
