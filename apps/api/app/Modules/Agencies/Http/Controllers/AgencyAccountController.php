<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Http\Controllers;

use App\Modules\Administration\Contracts\FileStorage;
use App\Modules\Agencies\Actions\ManagePayoutAccount;
use App\Modules\Agencies\Actions\RegisterAgency;
use App\Modules\Agencies\Models\AgencyDocument;
use App\Modules\Agencies\Support\AgencyContext;
use App\Modules\Identity\Enums\Locale;
use App\Modules\Identity\Models\User;
use App\Modules\Payouts\Models\PayoutAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Inscription d'une agence et pièces de son dossier (§23, B4).
 */
final class AgencyAccountController
{
    public function __construct(private readonly AgencyContext $context) {}

    /**
     * Publique : une agence peut s'inscrire elle-même.
     *
     * Elle naît `PENDING` et ne publie rien tant que l'administration ne l'a pas
     * validée — et aucun argent ne lui part tant que ses coordonnées ne sont pas
     * vérifiées.
     */
    public function register(Request $request, RegisterAgency $register): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'legal_name' => ['nullable', 'string', 'max:200'],
            'phone' => ['required', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'],
            'manager_first_name' => ['required', 'string', 'max:100'],
            'manager_last_name' => ['required', 'string', 'max:100'],
            'manager_phone' => ['required', 'string', 'max:20'],
            'locale' => ['nullable', 'string', 'in:fr,en'],
        ]);

        $otp = $register->handle(
            name: (string) $validated['name'],
            phone: (string) $validated['phone'],
            legalName: $validated['legal_name'] ?? null,
            email: $validated['email'] ?? null,
            managerFirstName: (string) $validated['manager_first_name'],
            managerLastName: (string) $validated['manager_last_name'],
            managerPhone: (string) $validated['manager_phone'],
            locale: Locale::from((string) ($validated['locale'] ?? 'fr')),
        );

        return response()->json([
            'expires_at' => $otp->expires_at?->toIso8601String(),
            'attempts_remaining' => $otp::MAX_ATTEMPTS - $otp->attempts,
        ], 201);
    }

    public function payoutAccounts(Request $request): JsonResponse
    {
        $agency = $this->context->require($request);

        return response()->json([
            'data' => $agency->payoutAccounts()->orderByDesc('created_at')->get()
                ->map($this->account(...))->all(),
        ]);
    }

    public function submitPayoutAccount(Request $request, ManagePayoutAccount $accounts): JsonResponse
    {
        $agency = $this->context->require($request);

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:MOBILE_MONEY,BANK'],
            'operator' => ['nullable', 'string', 'in:MTN,ORANGE', 'required_if:type,MOBILE_MONEY'],
            'account_number' => ['required', 'string', 'max:50'],
            'account_name' => ['required', 'string', 'max:150'],
        ]);

        $user = $request->user();

        $account = $accounts->submit(
            agency: $agency,
            type: (string) $validated['type'],
            operator: $validated['operator'] ?? null,
            accountNumber: (string) $validated['account_number'],
            accountName: (string) $validated['account_name'],
            submittedBy: $user instanceof User ? $user->id : null,
        );

        return response()->json($this->account($account), 201);
    }

    public function documents(Request $request): JsonResponse
    {
        $agency = $this->context->require($request);

        return response()->json([
            'data' => $agency->documents()->orderBy('type')->get()
                ->map($this->document(...))->all(),
        ]);
    }

    public function uploadDocument(Request $request, FileStorage $storage): JsonResponse
    {
        $agency = $this->context->require($request);

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:REGISTRATION,TRANSPORT_LICENCE,INSURANCE,ID_DOCUMENT,OTHER'],
            // Types et taille bornés : un dépôt libre est une porte d'entrée,
            // et le contenu n'est jamais servi depuis un chemin public.
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:8192'],
            'expires_at' => ['nullable', 'date'],
        ]);

        $file = $request->file('file');

        $document = $agency->documents()->create([
            'type' => $validated['type'],
            'file_path' => $storage->put($file, "agencies/{$agency->reference}"),
            'status' => 'PENDING',
            'expires_at' => $validated['expires_at'] ?? null,
        ]);

        return response()->json($this->document($document), 201);
    }

    /** @return array<string, mixed> */
    private function account(PayoutAccount $account): array
    {
        return [
            'id' => $account->id,
            'type' => $account->type,
            'operator' => $account->operator,
            'account_name' => $account->account_name,
            // Même tronquage que côté administration : le numéro complet n'a pas
            // à circuler dans une réponse d'API.
            'masked_number' => str_repeat('•', max(0, mb_strlen($account->account_number) - 3))
                .mb_substr($account->account_number, -3),
            'verified' => $account->verified_at !== null,
        ];
    }

    /** @return array<string, mixed> */
    private function document(AgencyDocument $document): array
    {
        return [
            'id' => $document->id,
            'type' => $document->type,
            'status' => $document->status,
            'expires_at' => $document->expires_at?->toDateString(),
            'uploaded_at' => $document->created_at?->toIso8601String(),
        ];
    }
}
