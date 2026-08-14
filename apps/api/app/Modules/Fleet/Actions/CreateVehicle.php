<?php

declare(strict_types=1);

namespace App\Modules\Fleet\Actions;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Fleet\Models\Vehicle;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Enregistre un véhicule et, en mode `SEATED`, son plan de sièges.
 *
 * Le plan est généré ici plutôt que saisi : demander à une agence de créer
 * trente sièges un par un garantirait qu'elle ne le fasse pas, et sans plan le
 * passager ne peut pas choisir sa place.
 */
final class CreateVehicle
{
    /** Quatre places par rangée : disposition courante des cars interurbains. */
    private const SEATS_PER_ROW = 4;

    public function handle(
        Agency $agency,
        string $registration,
        VehicleType $type,
        SeatingMode $seatingMode,
        int $capacity,
        ?string $brand = null,
        ?string $model = null,
        ?string $ownerPhone = null,
    ): Vehicle {
        return DB::transaction(function () use (
            $agency, $registration, $type, $seatingMode, $capacity, $brand, $model, $ownerPhone
        ): Vehicle {
            $vehicle = Vehicle::query()->create([
                'agency_id' => $agency->id,
                'owner_user_id' => $this->resolveOwner($ownerPhone),
                'registration' => $registration,
                'brand' => $brand,
                'model' => $model,
                'type' => $type,
                'seating_mode' => $seatingMode,
                'capacity' => $capacity,
                'condition' => 'ACTIVE',
            ]);

            if ($seatingMode === SeatingMode::Seated) {
                $this->layOutSeats($vehicle, $capacity);
            }

            return $vehicle;
        });
    }

    /**
     * Le propriétaire est rattaché **par son numéro de téléphone** (I3).
     *
     * Le compte est créé s'il n'existe pas : un propriétaire n'a pas à
     * s'inscrire avant qu'une agence lui confie un véhicule, et son accès reste
     * en consultation seule.
     */
    private function resolveOwner(?string $phone): ?int
    {
        if ($phone === null || trim($phone) === '') {
            return null;
        }

        $user = User::query()->firstOrCreate(
            ['phone' => trim($phone)],
            ['first_name' => 'Propriétaire', 'last_name' => 'à compléter'],
        );

        return $user->id;
    }

    private function layOutSeats(Vehicle $vehicle, int $capacity): void
    {
        $rows = [];

        for ($index = 0; $index < $capacity; $index++) {
            $row = intdiv($index, self::SEATS_PER_ROW);
            $column = $index % self::SEATS_PER_ROW;

            $rows[] = [
                'vehicle_id' => $vehicle->id,
                'label' => chr(65 + $row).($column + 1),
                'row_index' => $row + 1,
                'column_index' => $column + 1,
                'is_bookable' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        DB::table('vehicle_seats')->insert($rows);
    }
}
