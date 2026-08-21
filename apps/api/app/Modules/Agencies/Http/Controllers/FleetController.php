<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Http\Controllers;

use App\Modules\Agencies\Support\AgencyContext;
use App\Modules\Fleet\Actions\CreateVehicle;
use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Fleet\Enums\VehicleType;
use App\Modules\Fleet\Models\Driver;
use App\Modules\Fleet\Models\Vehicle;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class FleetController
{
    public function __construct(private readonly AgencyContext $context) {}

    public function vehicles(Request $request): JsonResponse
    {
        $agency = $this->context->require($request);

        $vehicles = Vehicle::query()
            ->where('agency_id', $agency->id)
            ->withCount('seats')
            ->orderBy('registration')
            ->get();

        return response()->json(['data' => $vehicles->map($this->presentVehicle(...))->all()]);
    }

    public function storeVehicle(Request $request, CreateVehicle $create): JsonResponse
    {
        $agency = $this->context->require($request);

        $validated = $request->validate([
            'registration' => ['required', 'string', 'max:20'],
            'brand' => ['nullable', 'string', 'max:80'],
            'model' => ['nullable', 'string', 'max:80'],
            'type' => ['required', Rule::enum(VehicleType::class)],
            'seating_mode' => ['required', Rule::enum(SeatingMode::class)],
            'capacity' => ['required', 'integer', 'min:1', 'max:90'],
            // Le propriétaire est rattaché par téléphone : son accès reste en
            // consultation seule, sans aucun circuit financier (I3).
            'owner_phone' => ['nullable', 'string', 'max:20'],
        ]);

        $duplicate = Vehicle::query()
            ->where('agency_id', $agency->id)
            ->where('registration', $validated['registration'])
            ->exists();

        if ($duplicate) {
            throw ApiException::of(
                ErrorCode::ValidationFailed,
                'Cette immatriculation est déjà enregistrée.',
            );
        }

        $vehicle = $create->handle(
            agency: $agency,
            registration: $validated['registration'],
            type: VehicleType::from($validated['type']),
            seatingMode: SeatingMode::from($validated['seating_mode']),
            capacity: (int) $validated['capacity'],
            brand: $validated['brand'] ?? null,
            model: $validated['model'] ?? null,
            ownerPhone: $validated['owner_phone'] ?? null,
        );

        return response()->json($this->presentVehicle($vehicle->loadCount('seats')), 201);
    }

    public function seats(Request $request, int $id): JsonResponse
    {
        $agency = $this->context->require($request);
        $vehicle = Vehicle::query()->whereKey($id)->firstOrFail();

        $this->context->own($agency, $vehicle->agency_id);

        $seats = $vehicle->seats()->orderBy('row_index')->orderBy('column_index')->get();

        return response()->json([
            'data' => $seats->map(fn ($seat): array => [
                'id' => $seat->id,
                'label' => $seat->label,
                'row_index' => $seat->row_index,
                'column_index' => $seat->column_index,
                'is_bookable' => $seat->is_bookable,
            ])->all(),
        ]);
    }

    public function drivers(Request $request): JsonResponse
    {
        $agency = $this->context->require($request);

        $drivers = Driver::query()
            ->where('agency_id', $agency->id)
            ->orderBy('last_name')
            ->get();

        return response()->json(['data' => $drivers->map($this->presentDriver(...))->all()]);
    }

    public function storeDriver(Request $request): JsonResponse
    {
        $agency = $this->context->require($request);

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            /*
             * Volontairement libre, contrairement aux numéros qui portent un
             * compte : un chauffeur n'en a pas — `storeDriver` ne crée qu'un
             * enregistrement métier, et rien ne lui envoie de code. On appelle
             * ce numéro, on ne s'y authentifie pas.
             */
            'phone' => ['required', 'string', 'max:20'],
            'license_number' => ['required', 'string', 'max:50'],
            'license_expires_at' => ['nullable', 'date'],
            'assigned_vehicle_id' => ['nullable', 'integer'],
        ]);

        if (isset($validated['assigned_vehicle_id'])) {
            $vehicle = Vehicle::query()->whereKey($validated['assigned_vehicle_id'])->firstOrFail();
            $this->context->own($agency, $vehicle->agency_id);
        }

        $driver = Driver::query()->create([
            'agency_id' => $agency->id,
            ...$validated,
            'status' => 'ACTIVE',
        ]);

        return response()->json($this->presentDriver($driver), 201);
    }

    /** @return array<string, mixed> */
    private function presentVehicle(Vehicle $vehicle): array
    {
        return [
            'id' => $vehicle->id,
            'registration' => $vehicle->registration,
            'brand' => $vehicle->brand,
            'model' => $vehicle->model,
            'type' => $vehicle->type,
            'seating_mode' => $vehicle->seating_mode,
            'capacity' => $vehicle->capacity,
            'seats_count' => $vehicle->getAttributes()['seats_count'] ?? null,
            'condition' => $vehicle->condition,
        ];
    }

    /** @return array<string, mixed> */
    private function presentDriver(Driver $driver): array
    {
        return [
            'id' => $driver->id,
            'first_name' => $driver->first_name,
            'last_name' => $driver->last_name,
            'phone' => $driver->phone,
            'license_number' => $driver->license_number,
            'license_expires_at' => $driver->license_expires_at?->toDateString(),
            'assigned_vehicle_id' => $driver->assigned_vehicle_id,
            'status' => $driver->status,
        ];
    }
}
