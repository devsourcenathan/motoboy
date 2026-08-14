<?php

declare(strict_types=1);

namespace App\Modules\Places\Actions;

use App\Modules\Administration\Actions\RecordAudit;
use App\Modules\Places\Models\City;
use App\Modules\Places\Models\CityRequest;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Traite une demande d'ajout de ville (B1, §23).
 *
 * Le référentiel géographique est une **liste fermée curée par MOTOBOY** : si
 * chaque agence pouvait créer la sienne, « Douala », « douala » et « Dla »
 * coexisteraient et la recherche cesserait de regrouper les offres.
 *
 * Mais une liste fermée sans recours bloque une agence desservant une ville
 * absente, qui abandonne. D'où ce circuit — et d'où la possibilité de
 * **rattacher** une demande à une ville existante plutôt que d'en créer une :
 * la plupart des demandes seront des variantes d'orthographe, et chacune
 * enrichit alors l'autocomplétion au lieu de dupliquer le référentiel.
 */
final class ResolveCityRequest
{
    public function __construct(private readonly RecordAudit $audit) {}

    public function approve(CityRequest $request, int $reviewerId, ?int $cityId = null): CityRequest
    {
        if ($request->status !== 'PENDING') {
            throw ApiException::of(ErrorCode::ValidationFailed, 'Cette demande est déjà traitée.');
        }

        return DB::transaction(function () use ($request, $reviewerId, $cityId): CityRequest {
            $city = $cityId === null
                ? $this->create($request)
                : City::query()->whereKey($cityId)->firstOrFail();

            // Rattachement à une ville existante : la graphie demandée devient
            // un alias, pour que l'autocomplétion la trouve la prochaine fois.
            if ($cityId !== null) {
                $city->aliases()->firstOrCreate(['alias' => $request->requested_name]);
            }

            $request->update([
                'status' => 'APPROVED',
                'resolved_city_id' => $city->id,
                'reviewed_by' => $reviewerId,
                'reviewed_at' => now(),
            ]);

            $this->audit->handle(
                action: 'city_request.approved',
                subject: $request,
                userId: $reviewerId,
                new: ['city_id' => $city->id, 'created' => $cityId === null],
            );

            return $request->refresh();
        });
    }

    public function reject(CityRequest $request, int $reviewerId): CityRequest
    {
        if ($request->status !== 'PENDING') {
            throw ApiException::of(ErrorCode::ValidationFailed, 'Cette demande est déjà traitée.');
        }

        $request->update([
            'status' => 'REJECTED',
            'reviewed_by' => $reviewerId,
            'reviewed_at' => now(),
        ]);

        $this->audit->handle('city_request.rejected', $request, $reviewerId);

        return $request->refresh();
    }

    private function create(CityRequest $request): City
    {
        return City::query()->create([
            'country_id' => $request->country_id,
            'name' => $request->requested_name,
            'slug' => Str::slug($request->requested_name),
            'is_active' => true,
        ]);
    }
}
