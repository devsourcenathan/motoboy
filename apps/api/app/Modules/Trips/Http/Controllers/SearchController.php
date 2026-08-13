<?php

declare(strict_types=1);

namespace App\Modules\Trips\Http\Controllers;

use App\Modules\Trips\Actions\SearchTrips;
use App\Modules\Trips\Actions\SuggestAlternatives;
use App\Modules\Trips\Http\Requests\SearchRequest;
use App\Modules\Trips\Http\Resources\TripSummaryResource;
use Illuminate\Http\JsonResponse;

/**
 * Contrôleur fin : il valide, appelle une Action, renvoie une ressource. Aucune
 * règle métier, aucune requête Eloquent non triviale, aucune transaction (§4 du
 * standard de code).
 */
final class SearchController
{
    public function __invoke(
        SearchRequest $request,
        SearchTrips $search,
        SuggestAlternatives $suggest,
    ): JsonResponse {
        $criteria = $request->criteria();
        $trips = $search->handle($criteria);

        return response()->json([
            'data' => TripSummaryResource::collection($trips)->resolve(),

            // Les suggestions ne sont calculées que si la recherche est vide :
            // les produire à chaque appel coûterait deux requêtes
            // supplémentaires pour une information que personne n'affiche.
            'suggestions' => $trips->isEmpty()
                ? $suggest->handle($criteria)
                : ['nearby_dates' => [], 'routes_served' => []],
        ]);
    }
}
