<?php

declare(strict_types=1);

namespace App\Modules\Rides\Actions;

use App\Modules\Rides\Enums\ServiceRequestStatus;
use App\Modules\Rides\Models\DriverProfile;
use App\Modules\Rides\Models\Ride;
use App\Modules\Rides\Models\RideOffer;
use App\Modules\Rides\Models\ServiceRequest;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Support\Facades\DB;

/**
 * Un chauffeur propose un prix sur une demande (E1).
 *
 * Quatre conditions, et chacune répond à une façon précise de tromper le
 * passager : un dossier non validé, un chauffeur déjà en course, une demande
 * morte, une ville qui n'est pas la sienne.
 */
final class MakeOffer
{
    /**
     * Validité d'une offre.
     *
     * Dix minutes : un prix annoncé il y a une heure ne vaut plus rien, et le
     * chauffeur qui l'a proposé est peut-être ailleurs. Laisser une offre vivre
     * aussi longtemps que la demande ferait accepter des engagements que
     * personne ne tient.
     */
    public const LIFETIME_MINUTES = 10;

    public function handle(
        ServiceRequest $request,
        DriverProfile $driver,
        int $priceAmount,
        int $etaMinutes,
    ): RideOffer {
        // Sans agence pour répondre d'un incident, la validation du dossier est
        // la seule barrière. Elle se vérifie ici, à chaque offre, et pas
        // seulement au moment de valider le dossier.
        if (!$driver->canDrive()) {
            throw ApiException::of(ErrorCode::DriverNotApproved, 'Dossier de chauffeur non valide.');
        }

        /*
         * Un chauffeur déjà en course ne peut pas être à deux endroits. L'index
         * partiel l'empêchera au moment d'accepter, mais le refuser dès l'offre
         * évite de faire espérer un passager pour rien.
         */
        $busy = Ride::query()
            ->where('driver_profile_id', $driver->id)
            ->whereIn('status', ['MATCHED', 'IN_PROGRESS'])
            ->exists();

        if ($busy) {
            throw ApiException::of(ErrorCode::DriverBusy, 'Une course est déjà en cours.');
        }

        if (!$request->isOpenForOffers()) {
            throw ApiException::of(ErrorCode::ServiceRequestClosed, 'Cette demande n\'attend plus d\'offre.');
        }

        /*
         * Portée de « sa ville » : égalité stricte avec la ville de départ.
         * Faute de coordonnées (E3), la proximité ne se calcule pas — et une
         * règle de villes voisines demanderait une table d'adjacence qui
         * n'existe pas. C'est un défaut assumé, à élargir quand le terrain le
         * dira.
         */
        if ($driver->city_id !== $request->origin_city_id) {
            throw ApiException::of(ErrorCode::Forbidden, 'Cette demande ne part pas de votre ville.');
        }

        return DB::transaction(function () use ($request, $driver, $priceAmount, $etaMinutes): RideOffer {
            $offer = RideOffer::query()->updateOrCreate(
                ['service_request_id' => $request->id, 'driver_profile_id' => $driver->id],
                [
                    'price_amount' => $priceAmount,
                    'eta_minutes' => $etaMinutes,
                    'status' => 'PENDING',
                    'expires_at' => now()->addMinutes(self::LIFETIME_MINUTES),
                ],
            );

            /*
             * La demande passe en « offres reçues ». Sans cet état, l'écran du
             * passager ne saurait pas distinguer « personne n'a encore vu » de
             * « trois chauffeurs proposent ».
             */
            if ($request->status === ServiceRequestStatus::Open) {
                $request->update(['status' => ServiceRequestStatus::Offered]);
            }

            return $offer;
        });
    }
}
