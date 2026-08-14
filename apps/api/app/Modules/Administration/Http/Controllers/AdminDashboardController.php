<?php

declare(strict_types=1);

namespace App\Modules\Administration\Http\Controllers;

use App\Modules\Administration\Support\AdminContext;
use App\Modules\Agencies\Models\Agency;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Fleet\Models\Vehicle;
use App\Modules\Identity\Models\User;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Enums\RefundStatus;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\Refund;
use App\Modules\Payouts\Enums\PayoutStatus;
use App\Modules\Payouts\Models\Commission;
use App\Modules\Payouts\Models\Payout;
use App\Modules\Tickets\Models\TicketValidation;
use App\Modules\Trips\Models\Trip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Chiffres de supervision (§23).
 *
 * **Calculés à la demande.** Pré-agréger avant d'avoir du volume produirait un
 * cache à invalider pour rien et une divergence de plus à déboguer — le même
 * raisonnement qui a fait écarter un solde stocké sur le compte courant. Le jour
 * où ces requêtes coûtent, elles se matérialiseront ; pas avant.
 */
final class AdminDashboardController
{
    public function __construct(private readonly AdminContext $context) {}

    public function __invoke(Request $request): JsonResponse
    {
        $this->context->require($request, 'payments.view');

        return response()->json([
            'users' => User::query()->whereNotNull('phone_verified_at')->count(),
            'agencies' => [
                'total' => Agency::query()->count(),
                // La file de travail de l'administration : c'est le chiffre qui
                // appelle une action, pas un indicateur de vanité.
                'pending' => Agency::query()->where('status', 'PENDING')->count(),
                'approved' => Agency::query()->where('status', 'APPROVED')->count(),
            ],
            'trips' => [
                'upcoming' => Trip::query()
                    ->where('status', 'SCHEDULED')
                    ->where('departure_at', '>=', now())
                    ->count(),
                /*
                 * Seules les annulations de départs **portant des réservations
                 * confirmées** comptent : supprimer un départ généré non assuré
                 * relève de la gestion de planning, pas de l'incident (I1). Une
                 * agence qui annule un départ sur cinq détruit la confiance dans
                 * la plateforme entière, pas seulement dans sa propre offre.
                 */
                'cancelled_30d' => Trip::query()
                    ->where('status', 'CANCELLED')
                    ->where('had_confirmed_bookings_at_cancellation', true)
                    ->where('cancelled_at', '>=', now()->subDays(30))
                    ->count(),
            ],
            'bookings' => [
                'confirmed' => Booking::query()->where('status', BookingStatus::Confirmed)->count(),
                'cancelled' => Booking::query()->whereIn('status', [
                    BookingStatus::CancelledByPassenger->value,
                    BookingStatus::CancelledByAgency->value,
                ])->count(),
            ],
            'tickets_validated' => TicketValidation::query()->count(),
            'vehicles_active' => Vehicle::query()->where('condition', 'ACTIVE')->count(),
            'revenue' => $this->money((int) Payment::query()
                ->where('status', PaymentStatus::Succeeded)
                ->sum('amount')),
            'commissions' => $this->money((int) Commission::query()->sum('amount')),
            'refunds' => $this->money((int) Refund::query()
                ->whereIn('status', [RefundStatus::Processing->value, RefundStatus::Completed->value])
                ->sum('amount')),
            'payouts_pending' => $this->money((int) Payout::query()
                ->whereIn('status', $this->inFlight())
                ->sum('net_amount')),
        ]);
    }

    /** @return array{amount: int, currency: string} */
    private function money(int $amount): array
    {
        return ['amount' => $amount, 'currency' => 'XAF'];
    }

    /** @return list<string> */
    private function inFlight(): array
    {
        return array_values(array_map(
            static fn (PayoutStatus $status): string => $status->value,
            array_filter(PayoutStatus::cases(), static fn (PayoutStatus $s): bool => $s->isInFlight()),
        ));
    }
}
