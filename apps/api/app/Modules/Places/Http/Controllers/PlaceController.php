<?php

declare(strict_types=1);

namespace App\Modules\Places\Http\Controllers;

use App\Modules\Places\Actions\AutocompletePlaces;
use App\Modules\Places\Data\PlaceSuggestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PlaceController
{
    public function autocomplete(Request $request, AutocompletePlaces $autocomplete): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:120'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:25'],
        ]);

        $suggestions = $autocomplete->handle(
            query: (string) $validated['q'],
            limit: (int) ($validated['limit'] ?? 10),
        );

        return response()->json([
            'data' => array_map(
                static fn (PlaceSuggestion $s): array => [
                    'type' => $s->type,
                    'city_id' => $s->cityId,
                    'station_id' => $s->stationId,
                    'label' => $s->label,
                    'secondary_label' => $s->secondaryLabel,
                ],
                $suggestions,
            ),
        ]);
    }
}
