<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Controllers;

use App\Modules\Bookings\Actions\CancelBooking;
use App\Modules\Bookings\Actions\CreateBooking;
use App\Modules\Bookings\Http\Requests\CreateBookingRequest;
use App\Modules\Bookings\Http\Resources\BookingResource;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Bookings\Support\CancellationTerms;
use App\Modules\Identity\Models\User;
use App\Modules\Payments\Models\Refund;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Contrôleur fin : il valide, appelle une Action, renvoie une ressource. Aucune
 * règle métier, aucune transaction (§4 du standard de code).
 */
final class BookingController
{
    /** @var list<string> */
    private const RELATIONS = [
        'trip.agency.commercialTerms',
        'trip.originStation.city',
        'trip.destinationStation.city',
        'trip.vehicle',
        'trip.route.stops.city',
        'passengers.seat',
        'passengers.ticket',
    ];

    public function store(CreateBookingRequest $request, CreateBooking $create): JsonResponse
    {
        $booking = $create->handle($request->newBooking());
        $booking->load(self::RELATIONS);

        return response()->json((new BookingResource($booking))->resolve(), 201);
    }

    /**
     * Historique du passager (§25 du brief).
     *
     * Trié par date de départ décroissante : le voyage qui vient est celui
     * qu'on cherche, pas le plus ancien.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max($request->integer('per_page', 20), 1), 100);

        $bookings = Booking::query()
            ->where('user_id', $request->user()?->getAuthIdentifier())
            ->when(
                $request->has('status'),
                fn ($query) => $query->whereIn('status', (array) $request->input('status')),
            )
            ->with(self::RELATIONS)
            ->join('trips', 'trips.id', '=', 'bookings.trip_id')
            ->orderByDesc('trips.departure_at')
            ->select('bookings.*')
            ->paginate($perPage);

        return response()->json([
            'data' => BookingResource::collection($bookings->items())->resolve(),
            'meta' => [
                'page' => $bookings->currentPage(),
                'per_page' => $bookings->perPage(),
                'total' => $bookings->total(),
                'last_page' => $bookings->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, string $reference): JsonResponse
    {
        $booking = Booking::query()
            ->where('reference', $reference)
            ->with(self::RELATIONS)
            ->firstOrFail();

        $this->own($request, $booking);

        return response()->json((new BookingResource($booking))->resolve());
    }

    /**
     * Annulation, totale ou partielle.
     *
     * L'annulation partielle est supportée dès le MVP : trois places réservées,
     * une annulée (B5).
     */
    public function cancel(Request $request, string $reference, CancelBooking $cancel): JsonResponse
    {
        $booking = Booking::query()->where('reference', $reference)->firstOrFail();

        $this->own($request, $booking);

        $validated = $request->validate([
            'passenger_ids' => ['array'],
            'passenger_ids.*' => ['integer'],
        ]);

        $user = $request->user();

        $result = $cancel->handle(
            $booking,
            array_values(array_map(intval(...), (array) ($validated['passenger_ids'] ?? []))),
            $user instanceof User ? $user->id : null,
        );

        return response()->json($this->cancellation($result));
    }

    /**
     * Devis d'annulation : ce que le passager récupérera, sans rien exécuter.
     *
     * Sans lui, le passager confirme à l'aveugle et découvre les frais retenus
     * après coup — ce qui transforme une règle acceptée en litige.
     */
    public function cancellationQuote(Request $request, string $reference): JsonResponse
    {
        $booking = Booking::query()
            ->where('reference', $reference)
            ->with('trip', 'passengers')
            ->firstOrFail();

        $this->own($request, $booking);

        /** @var list<int> $ids */
        $ids = array_values(array_map(intval(...), (array) $request->input('passenger_ids', [])));

        $seats = $ids === []
            ? $booking->activePassengers()->count()
            : $booking->activePassengers()->whereIn('id', $ids)->count();

        $terms = CancellationTerms::for($booking, $seats);

        return response()->json([
            'cancellable' => $terms->cancellable,
            'reason_if_not' => $terms->refusal?->value,
            'refundable' => ['amount' => $terms->refundable, 'currency' => $booking->currency],
            'fee' => ['amount' => $terms->fee, 'currency' => $booking->currency],
            'deadline_at' => $terms->deadlineAt?->toIso8601String(),
        ]);
    }

    /**
     * Forme partagée avec l'annulation agence : le contrat n'expose qu'un
     * `BookingCancellation`, et deux copies finiraient par diverger.
     *
     * @param  array{booking: Booking, refund: Refund|null, refunded: int, fee: int, cancelled: list<int>}  $result
     * @return array<string, mixed>
     */
    public static function cancellation(array $result): array
    {
        $booking = $result['booking'];
        $booking->load(self::RELATIONS);

        $refund = $result['refund'];

        return [
            'booking' => (new BookingResource($booking))->resolve(),
            'refund' => $refund === null ? null : [
                'reference' => $refund->reference,
                'status' => $refund->status,
                'reason' => $refund->reason,
                'amount' => ['amount' => $refund->amount, 'currency' => $refund->currency],
                'completed_at' => $refund->completed_at?->toIso8601String(),
            ],
            'refunded' => ['amount' => $result['refunded'], 'currency' => $booking->currency],
            'fee' => ['amount' => $result['fee'], 'currency' => $booking->currency],
            'cancelled_passenger_ids' => $result['cancelled'],
        ];
    }

    /**
     * La référence circule — sur un billet, un SMS, une capture d'écran. Elle
     * identifie, elle n'authentifie pas.
     */
    private function own(Request $request, Booking $booking): void
    {
        if ($booking->user_id !== $request->user()?->getAuthIdentifier()) {
            throw ApiException::of(ErrorCode::Forbidden, 'Cette réservation ne vous appartient pas.');
        }
    }
}
