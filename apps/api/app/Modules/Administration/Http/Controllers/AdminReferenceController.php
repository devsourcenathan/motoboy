<?php

declare(strict_types=1);

namespace App\Modules\Administration\Http\Controllers;

use App\Modules\Administration\Actions\RecordAudit;
use App\Modules\Administration\Models\AuditLog;
use App\Modules\Administration\Support\AdminContext;
use App\Modules\Places\Actions\ResolveCityRequest;
use App\Modules\Places\Models\CityRequest;
use App\Modules\Places\Models\Station;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Référentiel géographique et journal d'audit (§23, §28, B1).
 */
final class AdminReferenceController
{
    public function __construct(private readonly AdminContext $context) {}

    public function cityRequests(Request $request): JsonResponse
    {
        $this->context->require($request, 'places.manage');

        $requests = CityRequest::query()
            ->where('status', $request->string('status', 'PENDING')->value())
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => $requests->map($this->cityRequest(...))->all()]);
    }

    public function resolveCityRequest(Request $request, int $id, ResolveCityRequest $resolve): JsonResponse
    {
        $admin = $this->context->require($request, 'places.manage');

        $validated = $request->validate([
            'decision' => ['required', 'string', 'in:APPROVE,REJECT'],
            'city_id' => ['nullable', 'integer', 'exists:cities,id'],
        ]);

        $cityRequest = CityRequest::query()->whereKey($id)->firstOrFail();

        $resolved = $validated['decision'] === 'APPROVE'
            ? $resolve->approve(
                $cityRequest,
                $admin->id,
                isset($validated['city_id']) ? (int) $validated['city_id'] : null,
            )
            : $resolve->reject($cityRequest, $admin->id);

        return response()->json($this->cityRequest($resolved));
    }

    /**
     * Gares en attente de modération.
     *
     * La modération est **a posteriori** : la gare est publiée sans attendre.
     * Une validation préalable bloquerait une agence motivée plusieurs jours, et
     * elle renoncerait (B1).
     */
    public function stations(Request $request): JsonResponse
    {
        $this->context->require($request, 'places.manage');

        $moderated = $request->boolean('moderated');

        $stations = Station::query()
            ->when($moderated, fn ($query) => $query->whereNotNull('moderated_at'))
            ->when(!$moderated, fn ($query) => $query->whereNull('moderated_at'))
            ->with('city', 'agency')
            ->orderBy('created_at')
            ->limit(200)
            ->get();

        return response()->json([
            'data' => $stations->map(fn (Station $station): array => [
                'id' => $station->id,
                'name' => $station->name,
                'city' => $station->city?->name,
                'city_id' => $station->city_id,
                'address' => $station->address,
                'latitude' => $station->latitude,
                'longitude' => $station->longitude,
                'is_active' => $station->is_active,
                'moderated_at' => $station->moderated_at?->toIso8601String(),
            ])->all(),
        ]);
    }

    public function moderateStation(Request $request, int $id, RecordAudit $audit): JsonResponse
    {
        $admin = $this->context->require($request, 'places.manage');

        $validated = $request->validate([
            'decision' => ['required', 'string', 'in:KEEP,DEACTIVATE'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $station = Station::query()->whereKey($id)->with('city')->firstOrFail();
        $keep = $validated['decision'] === 'KEEP';

        $station->update([
            'is_active' => $keep,
            // Marquée modérée dans les deux cas : c'est la trace du passage,
            // sans quoi la même gare reviendrait indéfiniment dans la file.
            'moderated_at' => now(),
        ]);

        $audit->handle(
            action: $keep ? 'station.kept' : 'station.deactivated',
            subject: $station,
            userId: $admin->id,
            new: array_filter(['reason' => $validated['reason'] ?? null]),
        );

        return response()->json([
            'id' => $station->id,
            'name' => $station->name,
            'city' => $station->city?->name,
            'city_id' => $station->city_id,
            'address' => $station->address,
            'is_active' => $station->is_active,
            'moderated_at' => $station->refresh()->moderated_at?->toIso8601String(),
        ]);
    }

    /**
     * Journal d'audit — **réservé au super administrateur** (I4).
     *
     * En lecture seule, et rien d'autre : une entrée d'audit ne se modifie ni ne
     * se supprime, sans quoi elle ne prouverait plus rien.
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $this->context->require($request, 'audit.view');

        $perPage = min(max($request->integer('per_page', 20), 1), 100);

        $logs = AuditLog::query()
            ->when(
                $request->filled('action'),
                fn ($query) => $query->where('action', $request->string('action')->value()),
            )
            ->when(
                $request->filled('auditable_type'),
                fn ($query) => $query->where('auditable_type', $request->string('auditable_type')->value()),
            )
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'data' => array_map(fn (AuditLog $log): array => [
                'action' => $log->action,
                'auditable_type' => $log->auditable_type,
                'auditable_id' => $log->auditable_id,
                'user_id' => $log->user_id,
                'old_values' => $log->old_values,
                'new_values' => $log->new_values,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->toIso8601String(),
            ], $logs->items()),
            'meta' => [
                'page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function cityRequest(CityRequest $request): array
    {
        return [
            'id' => $request->id,
            'agency_id' => $request->agency_id,
            'country_id' => $request->country_id,
            'requested_name' => $request->requested_name,
            'status' => $request->status,
            'resolved_city_id' => $request->resolved_city_id,
            'reviewed_at' => $request->reviewed_at?->toIso8601String(),
        ];
    }
}
