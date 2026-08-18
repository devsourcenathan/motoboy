<?php

declare(strict_types=1);

namespace App\Modules\Fleet\Http\Controllers;

use App\Modules\Fleet\Models\Vehicle;
use App\Modules\Identity\Models\User;
use App\Modules\Trips\Models\Trip;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * L'espace du proprietaire de vehicule (I3).
 *
 * **En consultation seule, et aucun circuit financier.** Le proprietaire loue son
 * vehicule a une agence ; sa remuneration se regle directement avec elle. La
 * plateforme ne porte aucun flux vers lui, et lui ouvrir un espace qui parle
 * d'argent laisserait croire le contraire.
 *
 * Ce qu'il vient verifier est simple : **son vehicule roule-t-il ?** Les departs
 * qu'il a assures, et leur remplissage. C'est ce qui lui permet de discuter avec
 * l'agence sur des faits plutot que sur des impressions.
 *
 * Le chiffre d'affaires n'apparait que si l'agence l'a autorise, vehicule par
 * vehicule (`owner_revenue_visible`) : c'est une donnee commerciale de l'agence,
 * pas du proprietaire.
 */
final class OwnerController
{
    public function vehicles(Request $request): JsonResponse
    {
        $owner = $this->owner($request);

        $vehicles = Vehicle::query()
            ->where('owner_user_id', $owner->id)
            ->with('agency')
            ->orderBy('registration')
            ->get();

        return response()->json([
            'data' => $vehicles->map(fn (Vehicle $vehicle) => [
                'id' => $vehicle->id,
                'registration' => $vehicle->registration,
                'brand' => $vehicle->brand,
                'model' => $vehicle->model,
                'type' => $vehicle->type,
                'capacity' => $vehicle->capacity,
                // L'agence qui l'exploite : c'est son interlocuteur.
                'agency' => $vehicle->agency?->name,
                'revenue_visible' => (bool) $vehicle->owner_revenue_visible,
            ])->all(),
        ]);
    }

    /**
     * Les departs assures par un vehicule.
     *
     * Le remplissage plutot que les sieges vendus : c'est le rapport qui se
     * discute avec l'agence, et un nombre brut ne dit rien sans la capacite.
     */
    public function trips(Request $request, int $vehicle): JsonResponse
    {
        $owner = $this->owner($request);

        $owned = Vehicle::query()
            ->where('id', $vehicle)
            ->where('owner_user_id', $owner->id)
            ->first();

        if ($owned === null) {
            // Introuvable plutot qu'interdit : repondre « interdit » revelerait
            // que ce vehicule existe et appartient a quelqu'un d'autre.
            throw ApiException::of(ErrorCode::NotFound, 'Vehicule introuvable.');
        }

        /*
         * `withAvailability` plutot que `seats_taken` : ce compteur n'est un
         * garde-fou d'ecriture qu'en mode capacite, et les lignes de passagers
         * font foi en lecture dans les deux modes. Deux chemins de calcul
         * finiraient par diverger sur le chiffre meme dont on discute.
         *
         * La capacite vient du **depart** et non du vehicule : un vehicule peut
         * avoir ete remplace apres coup, et le remplissage d'alors se juge sur ce
         * qui etait offert ce jour-la.
         */
        $trips = Trip::query()
            ->where('vehicle_id', $owned->id)
            ->where('departure_at', '<=', now())
            ->withAvailability()
            ->orderByDesc('departure_at')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => $trips->map(function (Trip $trip): array {
                $capacity = (int) $trip->capacity;
                $sold = (int) ($trip->held_seats_count ?? 0);

                return [
                    'reference' => $trip->reference,
                    'departure_at' => $trip->departure_at?->toAtomString(),
                    'status' => $trip->status,
                    'capacity' => $capacity,
                    'seats_sold' => $sold,
                    /*
                     * Le taux, calcule par le serveur : le laisser au client
                     * ferait diverger deux arrondis, et c'est le chiffre dont on
                     * discute avec l'agence.
                     */
                    'fill_rate' => $capacity === 0 ? 0 : (int) round($sold * 100 / $capacity),
                ];
            })->all(),
        ]);
    }

    private function owner(Request $request): User
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session absente.');
        }

        return $user;
    }
}
