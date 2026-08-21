<?php

declare(strict_types=1);

namespace App\Modules\Administration\Http\Controllers;

use App\Modules\Administration\Support\AdminContext;
use App\Modules\Administration\Support\DocumentLink;
use App\Modules\Agencies\Actions\ManagePayoutAccount;
use App\Modules\Agencies\Actions\ReviewAgency;
use App\Modules\Agencies\Actions\UpdateCommercialTerms;
use App\Modules\Agencies\Http\Requests\UpdateCommercialTermsRequest;
use App\Modules\Agencies\Models\Agency;
use App\Modules\Agencies\Models\AgencyDocument;
use App\Modules\Payouts\Actions\AdjustLedger;
use App\Modules\Payouts\Models\Payee;
use App\Modules\Payouts\Models\PayoutAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Validation des agences et paramètres commerciaux (§23).
 */
final class AdminAgencyController
{
    public function __construct(private readonly AdminContext $context) {}

    public function index(Request $request): JsonResponse
    {
        $this->context->require($request, 'agencies.manage');

        $perPage = min(max($request->integer('per_page', 20), 1), 100);

        $agencies = Agency::query()
            ->when(
                $request->filled('status'),
                fn ($query) => $query->where('status', $request->string('status')->value()),
            )
            ->withCount('documents')
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'data' => array_map($this->summary(...), $agencies->items()),
            'meta' => [
                'page' => $agencies->currentPage(),
                'per_page' => $agencies->perPage(),
                'total' => $agencies->total(),
                'last_page' => $agencies->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, string $reference): JsonResponse
    {
        $this->context->require($request, 'agencies.manage');

        $agency = $this->find($reference);
        $agency->loadCount('documents');

        return response()->json([
            ...$this->summary($agency),
            'documents' => $agency->documents()->orderBy('type')->get()
                ->map(fn (AgencyDocument $doc): array => [
                    'id' => $doc->id,
                    'type' => $doc->type,
                    'status' => $doc->status,
                    'expires_at' => $doc->expires_at?->toDateString(),
                    'uploaded_at' => $doc->created_at?->toIso8601String(),
                    // Sans ce lien, l'écran énumère des pièces qu'on ne peut pas
                    // ouvrir, et l'admission se décide sur la seule présence des
                    // types attendus.
                    'url' => DocumentLink::for('agency', $doc->id),
                ])->all(),
            'payout_accounts' => $agency->payoutAccounts()->orderByDesc('created_at')->get()
                ->map($this->account(...))->all(),
            'commercial_terms' => $agency->commercialTerms?->only([
                'commission_type', 'commission_value', 'fee_bearer',
                'payout_delay_hours', 'payout_frequency', 'payout_day', 'payout_minimum_amount',
                'counter_sale_commission_enabled', 'counter_sale_sms_enabled',
                'cancellation_deadline_hours', 'cancellation_fee_type', 'cancellation_fee_value',
                'hold_duration_minutes', 'online_sales_cutoff_minutes',
            ]),
        ]);
    }

    public function approve(Request $request, string $reference, ReviewAgency $review): JsonResponse
    {
        $admin = $this->context->require($request, 'agencies.approve');

        return response()->json($this->summary($review->approve($this->find($reference), $admin->id)));
    }

    public function reject(Request $request, string $reference, ReviewAgency $review): JsonResponse
    {
        $admin = $this->context->require($request, 'agencies.approve');

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        return response()->json($this->summary(
            $review->reject($this->find($reference), $admin->id, (string) $validated['reason']),
        ));
    }

    /**
     * Réservé au `SUPER_ADMIN` : ce sont des termes négociés, et la permission
     * `commercial_terms.manage` n'est portée que par ce rôle (I4).
     */
    public function updateTerms(
        UpdateCommercialTermsRequest $request,
        string $reference,
        UpdateCommercialTerms $update,
    ): JsonResponse {
        $admin = $this->context->require($request, 'commercial_terms.manage');

        $terms = $update->handle($this->find($reference), $request->changes(), $admin->id);

        return response()->json($terms->only([
            'commission_type', 'commission_value', 'fee_bearer',
            'payout_delay_hours', 'payout_frequency', 'payout_day', 'payout_minimum_amount',
            'counter_sale_commission_enabled', 'counter_sale_sms_enabled',
            'cancellation_deadline_hours', 'cancellation_fee_type', 'cancellation_fee_value',
            'hold_duration_minutes', 'online_sales_cutoff_minutes',
        ]));
    }

    public function adjustLedger(Request $request, string $reference, AdjustLedger $adjust): JsonResponse
    {
        $admin = $this->context->require($request, 'payouts.approve');

        $validated = $request->validate([
            'amount' => ['required', 'integer', 'not_in:0'],
            // Motif obligatoire : une écriture manuelle sans explication est
            // indéfendable face à l'agence six mois plus tard.
            'description' => ['required', 'string', 'min:3', 'max:255'],
        ]);

        $entry = $adjust->handle(
            $this->find($reference),
            (int) $validated['amount'],
            (string) $validated['description'],
            $admin->id,
        );

        return response()->json([
            'type' => $entry->type,
            'amount' => ['amount' => (int) $entry->amount, 'currency' => $entry->currency],
            'description' => $entry->description,
            'reference_type' => $entry->reference_type,
            'occurred_at' => $entry->occurred_at?->toIso8601String(),
        ], 201);
    }

    public function verifyAccount(Request $request, int $id, ManagePayoutAccount $accounts): JsonResponse
    {
        $account = PayoutAccount::query()->with('payee')->whereKey($id)->firstOrFail();

        /*
         * **La permission suit le proprietaire du compte, pas l'endpoint.**
         *
         * Verifier ou un chauffeur independant sera paye n'est pas approuver une
         * agence : exiger `agencies.approve` fermait ce geste a qui modere
         * precisement les chauffeurs, et aucun compte de chauffeur n'aurait pu
         * etre verifie — donc aucun chauffeur paye.
         */
        $permission = $account->payee?->kind === Payee::KIND_DRIVER
            ? 'independent_drivers.moderate'
            : 'agencies.approve';

        $admin = $this->context->require($request, $permission);

        return response()->json($this->account($accounts->verify($account, $admin->id)));
    }

    /** @return array<string, mixed> */
    private function summary(Agency $agency): array
    {
        return [
            'reference' => $agency->reference,
            'name' => $agency->name,
            'legal_name' => $agency->legal_name,
            'phone' => $agency->phone,
            'email' => $agency->email,
            'status' => $agency->status,
            'approved_at' => $agency->approved_at?->toIso8601String(),
            'documents_count' => (int) ($agency->getAttributes()['documents_count'] ?? 0),
            // Tant que c'est faux, aucun reversement ne peut partir : c'est
            // l'information que l'administration doit voir en tête de liste.
            'has_verified_payout_account' => $agency->payoutAccounts()
                ->whereNotNull('verified_at')
                ->where('is_active', true)
                ->exists(),
        ];
    }

    /** @return array<string, mixed> */
    private function account(PayoutAccount $account): array
    {
        return [
            'id' => $account->id,
            'type' => $account->type,
            'operator' => $account->operator,
            'account_name' => $account->account_name,
            'masked_number' => str_repeat('•', max(0, mb_strlen($account->account_number) - 3))
                .mb_substr($account->account_number, -3),
            'verified' => $account->verified_at !== null,
        ];
    }

    private function find(string $reference): Agency
    {
        return Agency::query()
            ->where('reference', $reference)
            ->with('commercialTerms')
            ->firstOrFail();
    }
}
