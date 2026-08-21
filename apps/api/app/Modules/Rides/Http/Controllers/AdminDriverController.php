<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Controllers;

use App\Modules\Administration\Support\DocumentLink;
use App\Modules\Identity\Models\User;
use App\Modules\Rides\Actions\ReviewDriverApplication;
use App\Modules\Rides\Enums\DriverStatus;
use App\Modules\Rides\Http\Resources\DriverProfileResource;
use App\Modules\Rides\Models\DriverDocument;
use App\Modules\Rides\Models\DriverProfile;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Modération des dossiers chauffeur (E2, A1-A3).
 *
 * **La file se lit du plus ancien au plus récent.** Trier par date décroissante
 * ferait vivre indéfiniment le dossier déposé un jour de forte affluence — celui
 * dont l'auteur attend depuis le plus longtemps est celui qu'il faut instruire.
 */
final class AdminDriverController
{
    public function __construct(private readonly ReviewDriverApplication $review) {}

    public function index(Request $request): JsonResponse
    {
        $this->reviewer($request);

        $validated = $request->validate([
            'status' => ['nullable', Rule::enum(DriverStatus::class)],
        ]);

        $profiles = DriverProfile::query()
            ->with(['user', 'documents'])
            // Par défaut, ce qui attend une décision : c'est la seule chose que
            // cet écran a à faire avancer.
            ->where('status', $validated['status'] ?? DriverStatus::Pending->value)
            ->orderBy('created_at')
            ->paginate(20);

        return response()->json([
            'data' => $profiles->getCollection()
                ->map(fn (DriverProfile $profile) => $this->row($profile))
                ->all(),
            'meta' => [
                'page' => $profiles->currentPage(),
                'per_page' => $profiles->perPage(),
                'total' => $profiles->total(),
                'last_page' => $profiles->lastPage(),
            ],
        ]);
    }

    public function approve(Request $request, DriverProfile $driver): JsonResponse
    {
        return response()->json(
            (new DriverProfileResource(
                $this->review->approve($driver, $this->reviewer($request))->load('documents'),
            ))->resolve(),
        );
    }

    public function reject(Request $request, DriverProfile $driver): JsonResponse
    {
        // Le motif est obligatoire côté requête **et** en base : un refus qu'on
        // ne peut pas expliquer ne se produit pas.
        $validated = $request->validate([
            'note' => ['required', 'string', 'min:3', 'max:1000'],
        ]);

        return response()->json(
            (new DriverProfileResource(
                $this->review->reject($driver, $this->reviewer($request), $validated['note'])
                    ->load('documents'),
            ))->resolve(),
        );
    }

    public function suspend(Request $request, DriverProfile $driver): JsonResponse
    {
        $validated = $request->validate([
            'note' => ['required', 'string', 'min:3', 'max:1000'],
        ]);

        return response()->json(
            (new DriverProfileResource(
                $this->review->suspend($driver, $this->reviewer($request), $validated['note'])
                    ->load('documents'),
            ))->resolve(),
        );
    }

    /** @return array<string, mixed> */
    private function row(DriverProfile $profile): array
    {
        return [
            'id' => $profile->id,
            'status' => $profile->status->value,
            'submitted_at' => $profile->created_at?->toAtomString(),
            'driver' => [
                'first_name' => $profile->user?->first_name,
                'last_name' => $profile->user?->last_name,
                'phone' => $profile->user?->phone,
            ],
            'city_id' => $profile->city_id,
            'vehicle_plate' => $profile->vehicle_plate,
            /*
             * **Le type ne suffisait pas.** Cette liste ne portait que les types
             * déposés — « ce qui manque, d'un coup d'œil » — ce qui permet de
             * voir un dossier complet et jamais de l'instruire. On approuvait
             * un chauffeur sans avoir pu ouvrir son permis.
             */
            'documents' => $profile->documents->map(fn (DriverDocument $doc): array => [
                'id' => $doc->id,
                'type' => $doc->type->value,
                'expires_at' => $doc->expires_at?->toDateString(),
                'url' => DocumentLink::for('driver', $doc->id),
            ])->all(),
        ];
    }

    /**
     * Permission **globale** : un administrateur n'est rattaché à aucune agence,
     * contrairement au personnel d'agence dont les droits sont portés pour une
     * agence donnée (B3).
     *
     * Le contrôle est ici et non en middleware, comme partout dans l'espace
     * d'administration : c'est la convention du projet, et l'introduire
     * autrement aurait laissé deux endroits où chercher qui a le droit de quoi.
     */
    private function reviewer(Request $request): User
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session absente.');
        }

        if (!$user->hasGlobalPermission('independent_drivers.moderate')) {
            throw ApiException::of(ErrorCode::Forbidden, 'Permission insuffisante.');
        }

        return $user;
    }
}
