<?php

declare(strict_types=1);

namespace App\Modules\Administration\Http\Controllers;

use App\Modules\Administration\Actions\RecordAudit;
use App\Modules\Administration\Models\PlatformSetting;
use App\Modules\Administration\Support\RideCommission;
use App\Modules\Identity\Models\User;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Les parametres commerciaux de la plateforme.
 *
 * **Reserve au super-administrateur**, comme les bornes de B4 : c'est le partage
 * pose en I4 — l'exploitation quotidienne d'un cote, la configuration de la
 * plateforme de l'autre. Un taux de commission n'est pas une operation
 * quotidienne.
 */
final class PlatformSettingController
{
    public function __construct(
        private readonly RideCommission $commission,
        private readonly RecordAudit $audit,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $this->authorize($request);

        return response()->json($this->payload());
    }

    public function updateRideCommission(Request $request): JsonResponse
    {
        $actor = $this->authorize($request);

        $validated = $request->validate([
            // Borne dans la requete **et** dans l'accesseur : la premiere donne
            // un message utile, la seconde protege les ecritures qui ne passent
            // pas par ici.
            'commission_bps' => ['required', 'integer', 'min:0', 'max:'.RideCommission::MAX_BPS],
        ]);

        $before = $this->commission->currentBps();
        $after = $this->commission->update((int) $validated['commission_bps'], $actor);

        $setting = PlatformSetting::query()->where('key', RideCommission::KEY)->first();

        if ($setting !== null) {
            // Un taux de commission touche tout l'argent qui sortira ensuite :
            // savoir qui l'a change releve exactement de §28.
            $this->audit->handle(
                action: 'platform.ride_commission_changed',
                subject: $setting,
                userId: $actor->id,
                old: ['commission_bps' => $before],
                new: ['commission_bps' => $after],
            );
        }

        return response()->json($this->payload());
    }

    /** @return array<string, mixed> */
    private function payload(): array
    {
        return [
            'ride_commission_bps' => $this->commission->currentBps(),
            'ride_commission_max_bps' => RideCommission::MAX_BPS,
        ];
    }

    private function authorize(Request $request): User
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session requise.');
        }

        if (!$user->hasGlobalPermission('platform.configure')) {
            throw ApiException::of(ErrorCode::Forbidden, 'Permission insuffisante.');
        }

        return $user;
    }
}
