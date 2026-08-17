<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Controllers;

use App\Modules\Administration\Contracts\FileStorage;
use App\Modules\Identity\Models\User;
use App\Modules\Rides\Actions\SubmitDriverApplication;
use App\Modules\Rides\Enums\DriverDocumentType;
use App\Modules\Rides\Http\Requests\SubmitDriverApplicationRequest;
use App\Modules\Rides\Http\Resources\DriverProfileResource;
use App\Modules\Rides\Models\DriverProfile;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

/**
 * Son propre dossier de chauffeur (E2).
 *
 * Tout est à la première personne : un chauffeur ne lit et ne modifie que le
 * sien. Il n'y a donc aucune autorisation à vérifier au-delà de la session — le
 * dossier est atteint par l'utilisateur, jamais par un identifiant d'URL.
 */
final class DriverController
{
    public function show(Request $request): JsonResponse
    {
        $profile = $this->profileOf($request);

        return response()->json(
            (new DriverProfileResource($profile->load('documents')))->resolve(),
        );
    }

    public function submit(
        SubmitDriverApplicationRequest $request,
        SubmitDriverApplication $submit,
    ): JsonResponse {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session absente.');
        }

        $profile = $submit->handle($user, $request->validated());

        return response()->json(
            (new DriverProfileResource($profile->load('documents')))->resolve(),
            201,
        );
    }

    /**
     * Dépose une pièce, ou remplace celle du même type.
     *
     * Le fichier passe par le port de stockage : son nom d'origine n'est jamais
     * repris, et le contenu n'est servi que par une URL à durée limitée.
     */
    public function uploadDocument(Request $request, FileStorage $storage): JsonResponse
    {
        $profile = $this->profileOf($request);

        $validated = $request->validate([
            'type' => ['required', Rule::enum(DriverDocumentType::class)],
            // Types et taille bornés : un dépôt libre est une porte d'entrée.
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:8192'],
            'expires_at' => ['nullable', 'date'],
        ]);

        $file = $request->file('file');

        if (!$file instanceof UploadedFile) {
            throw ApiException::of(ErrorCode::ValidationFailed, 'Fichier absent.');
        }

        $profile->documents()->updateOrCreate(
            ['type' => $validated['type']],
            [
                'file_path' => $storage->put($file, "drivers/{$profile->id}"),
                'expires_at' => $validated['expires_at'] ?? null,
            ],
        );

        return response()->json(
            (new DriverProfileResource($profile->load('documents')))->resolve(),
        );
    }

    private function profileOf(Request $request): DriverProfile
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session absente.');
        }

        $profile = DriverProfile::query()->where('user_id', $user->id)->first();

        if ($profile === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Aucun dossier de chauffeur.');
        }

        return $profile;
    }
}
