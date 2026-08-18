<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Http\Controllers;

use App\Modules\Agencies\Support\AgencyContext;
use App\Modules\Bookings\Models\BookingPassenger;
use App\Modules\Identity\Models\User;
use App\Modules\Tickets\Actions\BuildBoardingList;
use App\Modules\Tickets\Actions\SyncTicketValidations;
use App\Modules\Tickets\Enums\TicketStatus;
use App\Modules\Tickets\Http\Requests\SyncValidationsRequest;
use App\Modules\Tickets\Models\Ticket;
use App\Modules\Trips\Http\Resources\TripSummaryResource;
use App\Modules\Trips\Models\Trip;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

final class BoardingController
{
    public function __construct(private readonly AgencyContext $context) {}

    /**
     * Départs de l'agence, pour que l'agent choisisse le sien.
     *
     * C'est le premier écran de la PWA d'embarquement : sans lui, l'agent
     * devrait connaître par cœur la référence du départ qu'il contrôle.
     */
    public function trips(Request $request): JsonResponse
    {
        $agency = $this->context->require($request, 'tickets.validate');

        $perPage = min(max($request->integer('per_page', 20), 1), 100);

        $trips = Trip::query()
            ->where('agency_id', $agency->id)
            ->when($request->filled('from'), fn ($q) => $q->where('departure_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->where('departure_at', '<=', $request->date('to')))
            ->withAvailability()
            ->with('agency.commercialTerms', 'originStation.city', 'destinationStation.city',
                'vehicle', 'route.stops.city')
            ->orderBy('departure_at')
            ->paginate($perPage);

        return response()->json([
            'data' => TripSummaryResource::collection($trips->items())->resolve(),
            'meta' => [
                'page' => $trips->currentPage(),
                'per_page' => $trips->perPage(),
                'total' => $trips->total(),
                'last_page' => $trips->lastPage(),
            ],
        ]);
    }

    public function list(Request $request, string $reference, BuildBoardingList $build): JsonResponse
    {
        $trip = $this->authorizedTrip($request, $reference);
        $tickets = $build->handle($trip);

        return response()->json([
            'trip' => (new TripSummaryResource($trip))->resolve(),
            // Permet à l'agent de juger la fraîcheur de sa copie locale.
            'generated_at' => now()->toIso8601String(),
            'passengers' => $tickets->map(fn (Ticket $t): array => $this->passenger($t))->values()->all(),
        ]);
    }

    public function sync(
        SyncValidationsRequest $request,
        string $reference,
        SyncTicketValidations $sync,
    ): JsonResponse {
        $trip = $this->authorizedTrip($request, $reference);

        /** @var User $agent */
        $agent = $request->user();

        $outcomes = $sync->handle(
            trip: $trip,
            agent: $agent,
            deviceId: $request->filled('device_id') ? $request->string('device_id')->toString() : null,
            queued: $request->queued(),
        );

        // 200 même lorsque des éléments sont rejetés : la synchronisation n'est
        // pas du tout-ou-rien, un doublon ne doit pas faire échouer les
        // quarante autres validations du même car (B3).
        return response()->json([
            'results' => array_map(static fn ($outcome): array => array_filter([
                'client_id' => $outcome->clientId,
                'ticket_reference' => $outcome->ticketReference,
                'status' => $outcome->status,
                'code' => $outcome->code?->value,
                'first_validated_at' => $outcome->firstValidatedAt?->toIso8601String(),
            ], static fn ($value): bool => $value !== null), $outcomes),
        ]);
    }

    /**
     * Secours en ligne : saisie manuelle d'une référence, ou levée de doute sur
     * un cas affiché par la PWA.
     */
    public function lookup(Request $request, SyncTicketValidations $sync): JsonResponse
    {
        $validated = $request->validate([
            'reference' => ['required', 'string', 'max:30'],
            'trip_reference' => ['required', 'string', 'max:20'],
        ]);

        $trip = $this->authorizedTrip($request, (string) $validated['trip_reference']);

        $ticket = Ticket::query()
            ->where('reference', $validated['reference'])
            ->with('passenger.seat', 'booking.passengers.ticket', 'validations')
            ->first();

        if ($ticket === null) {
            throw ApiException::of(ErrorCode::TicketNotFound, 'Référence inconnue.');
        }

        if ($ticket->trip_id !== $trip->id) {
            throw ApiException::of(ErrorCode::TicketWrongTrip, 'Ce billet concerne un autre départ.');
        }

        if ($ticket->status === TicketStatus::Cancelled || $ticket->booking?->status?->isCancelled() === true) {
            throw ApiException::of(ErrorCode::TicketCancelled, 'Ce billet a été annulé.');
        }

        $first = $ticket->validations->firstWhere('is_duplicate', false);

        if ($first !== null) {
            throw ApiException::of(
                ErrorCode::TicketAlreadyValidated,
                'Billet déjà validé.',
                ['first_validated_at' => $first->validated_at?->toIso8601String()],
            );
        }

        return response()->json($this->passenger($ticket));
    }

    /**
     * Charge le départ **et** vérifie que l'utilisateur peut valider pour
     * l'agence qui l'exploite.
     *
     * La portée par agence est le cœur du modèle : sans elle, un agent
     * d'embarquement validerait les billets de toutes les agences de la
     * plateforme (B3).
     */
    private function authorizedTrip(Request $request, string $reference): Trip
    {
        $trip = Trip::query()
            ->where('reference', $reference)
            ->with('agency.commercialTerms', 'originStation.city', 'destinationStation.city',
                'vehicle', 'route.stops.city')
            ->firstOrFail();

        $user = $request->user();

        if (!$user instanceof User || !$user->hasPermissionForAgency('tickets.validate', $trip->agency_id)) {
            throw ApiException::of(
                ErrorCode::Forbidden,
                'Vous ne validez pas les billets de cette agence.',
            );
        }

        return $trip;
    }

    /** @return array<string, mixed> */
    private function passenger(Ticket $ticket): array
    {
        $booking = $ticket->booking;

        /** @var Collection<int, BookingPassenger> $group */
        $group = $booking === null ? collect() : $booking->passengers;

        $first = $ticket->validations->firstWhere('is_duplicate', false);

        return [
            'ticket_reference' => $ticket->reference,
            'booking_reference' => $booking?->reference,
            'passenger_name' => $ticket->passenger?->fullName(),
            'seat_label' => $ticket->passenger?->seat?->label,
            'status' => $ticket->status,
            // « 2/3 validés » : l'agent doit savoir qui manque encore dans un
            // groupe avant de fermer la porte.
            'group_size' => $group->count(),
            'group_validated' => $group->filter(
                fn ($p): bool => $p->ticket?->status === TicketStatus::Used,
            )->count(),
            'validated_at' => $first?->validated_at?->toIso8601String(),
        ];
    }
}
