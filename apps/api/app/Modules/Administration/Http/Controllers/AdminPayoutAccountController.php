<?php

declare(strict_types=1);

namespace App\Modules\Administration\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Payouts\Models\Payee;
use App\Modules\Payouts\Models\PayoutAccount;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Les destinations de virement a verifier (B4, C9).
 *
 * **Le geste manquait, et rien ne pouvait etre verse.** Un chauffeur declare son
 * compte Mobile Money, celui-ci reste inactif jusqu'a verification, et la passe
 * de reversement s'arrete sur `NO_VERIFIED_ACCOUNT`. Sans cet ecran, personne
 * n'etait paye — sans qu'aucune erreur ne le signale.
 *
 * Non verifies d'abord : c'est la seule chose que cette page a a faire avancer.
 */
final class AdminPayoutAccountController
{
    public function index(Request $request): JsonResponse
    {
        $this->reviewer($request);

        $validated = $request->validate([
            'kind' => ['nullable', 'string', 'in:AGENCY,DRIVER'],
        ]);

        $accounts = PayoutAccount::query()
            ->with(['payee.agency', 'payee.user'])
            ->when(
                isset($validated['kind']),
                fn ($query) => $query->whereHas(
                    'payee',
                    fn ($payee) => $payee->where('kind', $validated['kind']),
                ),
            )
            /*
             * Les non verifies en tete, puis du plus ancien au plus recent :
             * celui qui attend depuis le plus longtemps attend son argent.
             */
            ->orderByRaw('verified_at is not null')
            ->orderBy('created_at')
            ->paginate(20);

        return response()->json([
            'data' => $accounts->getCollection()->map($this->row(...))->all(),
            'meta' => [
                'page' => $accounts->currentPage(),
                'per_page' => $accounts->perPage(),
                'total' => $accounts->total(),
                'last_page' => $accounts->lastPage(),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function row(PayoutAccount $account): array
    {
        $payee = $account->payee;

        return [
            'id' => $account->id,
            'kind' => $payee?->kind,
            /*
             * Le nom du beneficiaire, pas seulement son identifiant : celui qui
             * verifie compare ce nom a celui du compte Mobile Money declare, et
             * c'est tout l'objet du controle.
             */
            'owner' => $this->ownerName($payee),
            'owner_phone' => $payee?->user?->phone,
            'type' => $account->type,
            'operator' => $account->operator,
            'account_name' => $account->account_name,
            // Tronque, comme partout : le numero complet n'a pas a circuler.
            'masked_number' => str_repeat('•', max(0, mb_strlen($account->account_number) - 3))
                .mb_substr($account->account_number, -3),
            'verified' => $account->verified_at !== null,
            'submitted_at' => $account->created_at?->toAtomString(),
        ];
    }

    /**
     * Le nom du proprietaire, agence ou personne.
     *
     * Ecrit en clair plutot qu'en chaine d'operateurs : les deux genres n'ont pas
     * la meme source, et l'expression ternaire qui melangeait les deux se lisait
     * moins bien qu'un `if`.
     */
    private function ownerName(?Payee $payee): ?string
    {
        if ($payee === null) {
            return null;
        }

        if ($payee->kind === Payee::KIND_AGENCY) {
            return $payee->agency?->name;
        }

        $user = $payee->user;

        return $user === null ? null : $user->fullName();
    }

    /**
     * Qui peut voir cette file.
     *
     * L'une ou l'autre permission : la file melange comptes d'agence et comptes
     * de chauffeur, et exiger les deux fermerait la page a chacun des deux
     * metiers. C'est la **verification** qui distingue, endpoint par endpoint.
     */
    private function reviewer(Request $request): User
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session absente.');
        }

        $allowed = $user->hasGlobalPermission('agencies.approve')
            || $user->hasGlobalPermission('independent_drivers.moderate');

        if (!$allowed) {
            throw ApiException::of(ErrorCode::Forbidden, 'Permission insuffisante.');
        }

        return $user;
    }
}
