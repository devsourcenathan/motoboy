<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Payouts\Actions\ApprovePayout;
use App\Modules\Payouts\Actions\BuildDuePayouts;
use App\Modules\Payouts\Actions\SendPayout;
use App\Modules\Payouts\Http\Resources\PayoutResource;
use App\Modules\Payouts\Models\Payout;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Le côté administration du circuit de reversement (B4).
 *
 * **Ouvert au strict nécessaire.** Le reste de l'espace d'administration reste à
 * construire ; sans ces trois opérations, le circuit financier ne se referme
 * jamais — le calcul est automatique mais rien ne le valide ni ne l'envoie.
 */
final class AdminPayoutController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeView($request);

        $perPage = min(max($request->integer('per_page', 20), 1), 100);

        $payouts = Payout::query()
            /*
             * Charge en amont ce que la ressource nomme : sans cela,
             * `loadMissing` s'execute par ligne et une page de vingt fait
             * soixante requetes de plus.
             */
            ->with(['payee.agency', 'payee.user', 'account'])
            ->when(
                $request->filled('status'),
                fn ($query) => $query->where('status', $request->string('status')->value()),
            )
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'data' => PayoutResource::collection($payouts->items())->resolve(),
            'meta' => [
                'page' => $payouts->currentPage(),
                'per_page' => $payouts->perPage(),
                'total' => $payouts->total(),
                'last_page' => $payouts->lastPage(),
            ],
        ]);
    }

    /**
     * Calcule les reversements dus. **Ne verse rien.**
     *
     * Un job quotidien fait la même chose ; l'endpoint existe pour qu'un
     * administrateur relance sans attendre le lendemain — typiquement après
     * avoir vérifié des coordonnées qui manquaient la veille.
     */
    public function build(Request $request, BuildDuePayouts $build): JsonResponse
    {
        $this->authorize($request, 'payouts.approve');

        $validated = $request->validate(['agency_id' => ['nullable', 'integer']]);
        $agencyId = isset($validated['agency_id']) ? (int) $validated['agency_id'] : null;

        // Déclenché à la main, donc sans attendre le jour de cadence : c'est
        // tout l'intérêt de pouvoir relancer.
        $result = $build->handle($agencyId, force: true);

        return response()->json([
            'created' => array_map(
                fn (Payout $payout): array => (new PayoutResource($payout))->resolve(),
                $result['created'],
            ),
            'skipped' => array_map(fn (array $row): array => [
                'agency_id' => $row['agency_id'],
                'reason' => $row['reason'],
                'balance' => ['amount' => $row['balance'], 'currency' => 'XAF'],
            ], $result['skipped']),
        ]);
    }

    public function approve(Request $request, string $reference, ApprovePayout $approve): JsonResponse
    {
        $user = $this->authorize($request, 'payouts.approve');

        $payout = Payout::query()
            ->where('reference', $reference)
            ->with(['payee.agency', 'payee.user', 'account'])
            ->firstOrFail();

        return response()->json((new PayoutResource($approve->handle($payout, $user->id)))->resolve());
    }

    public function send(Request $request, string $reference, SendPayout $send): JsonResponse
    {
        $this->authorize($request, 'payouts.approve');

        $key = $request->header('Idempotency-Key');

        if (!is_string($key) || trim($key) === '') {
            throw ApiException::of(
                ErrorCode::ValidationFailed,
                'En-tête Idempotency-Key requise sur un décaissement.',
            );
        }

        $payout = Payout::query()
            ->where('reference', $reference)
            ->with(['payee.agency', 'payee.user', 'account'])
            ->firstOrFail();

        return response()->json((new PayoutResource($send->handle($payout, trim($key))))->resolve());
    }

    private function authorizeView(Request $request): User
    {
        return $this->authorize($request, 'payouts.view');
    }

    /**
     * Permission **globale** : un administrateur n'est rattaché à aucune agence,
     * contrairement au personnel d'agence dont les droits sont portés pour une
     * agence donnée (B3).
     */
    private function authorize(Request $request, string $permission): User
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session requise.');
        }

        if (!$user->hasGlobalPermission($permission)) {
            throw ApiException::of(ErrorCode::Forbidden, 'Permission insuffisante.');
        }

        return $user;
    }
}
