<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Support;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Support\Http\ErrorCode;
use Carbon\CarbonImmutable;

/**
 * Ce qu'une annulation coûte, et si elle est seulement possible.
 *
 * **Les conditions viennent de la réservation, jamais de l'agence.** Elles y ont
 * été figées à l'achat : si une agence durcit ses conditions, les réservations
 * existantes conservent celles affichées au passager avant qu'il paie (B5).
 *
 * Un seul seuil, pas de grille dégressive. Une grille à paliers serait plus
 * juste mais indéfendable à expliquer sur un écran de téléphone — et la logique
 * économique tient en une phrase : une annulation précoce laisse à l'agence le
 * temps de revendre la place, une annulation tardive lui fait perdre le siège.
 *
 * Lu par le devis comme par l'annulation elle-même. Ce n'est pas un instantané :
 * le jour où le calcul change, les deux doivent changer ensemble, sans quoi le
 * passager verrait un montant et en recevrait un autre.
 */
final readonly class CancellationTerms
{
    /** Les pourcentages sont en points de base : 2000 vaut 20 %. */
    private const BASIS_POINTS = 10_000;

    private function __construct(
        public bool $cancellable,
        public ?ErrorCode $refusal,
        /** Part payée des places annulées. */
        public int $paidShare,
        public int $fee,
        public int $refundable,
        public ?CarbonImmutable $deadlineAt,
    ) {}

    public static function for(Booking $booking, int $seats): self
    {
        $deadline = self::deadline($booking);
        $share = self::paidShare($booking, $seats);
        $refusal = self::refusal($booking, $deadline);

        if ($refusal !== null) {
            return new self(false, $refusal, $share, 0, 0, $deadline);
        }

        $fee = self::fee($booking, $share);

        return new self(true, null, $share, $fee, $share - $fee, $deadline);
    }

    /**
     * Part payée des places annulées.
     *
     * Répartie au prorata plutôt que recalculée au tarif courant : `total_amount`
     * est ce qui a été encaissé, et le tarif d'un départ ne peut de toute façon
     * pas changer pour une réservation déjà confirmée (B5).
     */
    private static function paidShare(Booking $booking, int $seats): int
    {
        if ($booking->seats_count <= 0) {
            return 0;
        }

        return intdiv($booking->total_amount * $seats, $booking->seats_count);
    }

    private static function fee(Booking $booking, int $share): int
    {
        $fee = $booking->cancellation_fee_type === 'FIXED'
            ? $booking->cancellation_fee_value
            : intdiv($share * $booking->cancellation_fee_value, self::BASIS_POINTS);

        // Les frais ne peuvent pas excéder ce qui a été payé : au-delà, la
        // plateforme réclamerait de l'argent pour une annulation.
        return max(0, min($fee, $share));
    }

    /**
     * ⚠️ **Point où B5 et le contrat ne disent pas tout à fait la même chose.**
     *
     * B5 écrit « au-delà du délai, non remboursable », ce qui parle d'argent et
     * laisserait l'annulation possible à zéro franc — le siège repartirait à la
     * vente. Le contrat, lui, liste `CANCELLATION_DEADLINE_PASSED` en 409 sur
     * `POST /v1/bookings/{reference}/cancel`.
     *
     * Le contrat étant normatif, c'est lui qui tranche ici : au-delà du délai,
     * l'annulation est refusée. Relâcher cette borne se décide dans la
     * spécification, pas dans ce fichier.
     */
    private static function refusal(Booking $booking, ?CarbonImmutable $deadline): ?ErrorCode
    {
        if ($booking->status !== BookingStatus::Confirmed) {
            return ErrorCode::BookingNotCancellable;
        }

        if ($deadline !== null && $deadline->isPast()) {
            return ErrorCode::CancellationDeadlinePassed;
        }

        return null;
    }

    private static function deadline(Booking $booking): ?CarbonImmutable
    {
        $departure = $booking->trip?->departure_at;

        return $departure?->subHours($booking->cancellation_deadline_hours);
    }
}
