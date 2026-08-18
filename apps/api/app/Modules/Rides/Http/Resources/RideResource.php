<?php

declare(strict_types=1);

namespace App\Modules\Rides\Http\Resources;

use App\Modules\Administration\Support\RideCommission;
use App\Modules\Rides\Models\Ride;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Ride */
final class RideResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray($request): array
    {
        $paid = $this->isPaid();

        /*
         * La commission est lue au taux courant, pas recopiee dans le client.
         * Le taux se regle depuis le dashboard : un pourcentage en dur cote
         * mobile annoncerait un net faux le jour ou il change, et le chauffeur
         * s'en apercevrait au reversement.
         */
        $commission = app(RideCommission::class)->on($this->price_amount);

        return [
            'reference' => $this->reference,
            'status' => $this->status->value,
            'price' => ['amount' => $this->price_amount, 'currency' => $this->currency],
            'commission' => ['amount' => $commission, 'currency' => $this->currency],
            'driver_amount' => [
                'amount' => $this->price_amount - $commission,
                'currency' => $this->currency,
            ],
            'started_at' => $this->started_at?->toAtomString(),
            'completed_at' => $this->completed_at?->toAtomString(),
            'paid' => $paid,
            /*
             * **Les telephones n'apparaissent qu'une fois la course payee.**
             *
             * C'est ce que le passager achete, et ce qui tient le chauffeur a la
             * plateforme. Le laisser au client decider de l'afficher etait un
             * leurre : le numero partait dans la reponse, et il suffisait de
             * regarder le JSON pour l'avoir sans payer.
             */
            'driver' => (fn () => [
                'first_name' => $this->loadMissing('driver.user')->driver?->user?->first_name,
                'last_name' => $this->driver?->user?->last_name,
                'phone' => $paid ? $this->driver?->user?->phone : null,
                'vehicle_plate' => $this->driver?->vehicle_plate,
                'vehicle_model' => $this->driver?->vehicle_model,
            ])(),
            /*
             * Le miroir du bloc precedent, pour le chauffeur : la ressource etait
             * ecrite du seul point de vue du passager, et ne disait donc rien de
             * qui il doit aller chercher.
             */
            'passenger' => (fn () => [
                'first_name' => $this->loadMissing('request.passenger')->request?->passenger?->first_name,
                'last_name' => $this->request?->passenger?->last_name,
                'phone' => $paid ? $this->request?->passenger?->phone : null,
            ])(),
        ];
    }
}
