<?php

declare(strict_types=1);

namespace App\Modules\Payments\Console;

use App\Modules\Payments\Actions\ConfirmPayment;
use App\Modules\Payments\Actions\ConfirmRefund;
use App\Modules\Payments\Contracts\PaymentGateway;
use App\Modules\Payments\Enums\PaymentStatus;
use App\Modules\Payments\Http\Controllers\WebhookController;
use App\Modules\Payments\Models\Payment;
use Illuminate\Console\Command;
use Illuminate\Http\Request;

/**
 * Joue le webhook que l'agrégateur enverrait, en développement.
 *
 * Le pilote factice n'encaisse jamais de façon synchrone — c'est délibéré, le
 * vrai Mobile Money non plus. Le parcours s'arrête donc sur un écran d'attente
 * jusqu'à ce qu'un webhook arrive, et sans prestataire branché il n'arrive
 * jamais. Confirmer à la main demandait de lire `provider_reference` en base au
 * milieu d'un test sur téléphone : la référence `fake-…` n'apparaît nulle part
 * côté passager.
 *
 * **La charge utile passe par le vrai contrôleur**, pas par un raccourci vers
 * l'action : le journal des webhooks, l'idempotence sur `(provider, event_id)`
 * et l'émission des billets sont précisément ce qu'on veut exercer. Un raccourci
 * validerait un chemin que la production n'emprunte pas.
 */
final class ConfirmPaymentCommand extends Command
{
    protected $signature = 'motoboy:confirm-payment
        {subject? : Référence de réservation (BKG-) ou de course (RID-) — à défaut, le dernier paiement en attente}
        {--fail= : Joue un échec avec ce motif, au lieu d\'un succès}
        {--fee=0 : Frais retenus par l\'agrégateur, en centimes}';

    protected $description = 'Développement : joue le webhook de l\'agrégateur sur un paiement en attente.';

    public function handle(
        PaymentGateway $gateway,
        ConfirmPayment $confirm,
        ConfirmRefund $confirmRefund,
        WebhookController $controller,
    ): int {
        /*
         * Deux verrous, qui ne disent pas la même chose. L'environnement écarte
         * la production ; le pilote écarte le cas où un vrai agrégateur est
         * branché ailleurs. Une commande qui marque un paiement comme encaissé
         * est un distributeur de billets gratuits : elle ne doit pouvoir
         * s'exécuter que là où l'argent est fictif.
         */
        if ($this->getLaravel()->environment('production')) {
            $this->error('Refusé en production : cette commande fabrique un encaissement.');

            return self::FAILURE;
        }

        if (config('payments.gateway') !== 'fake') {
            $this->error('Refusé : un agrégateur réel est configuré, ses webhooks sont les seuls valables.');

            return self::FAILURE;
        }

        $payment = $this->locate();

        if ($payment === null) {
            return self::FAILURE;
        }

        $reason = $this->option('fail');
        $failing = is_string($reason) && $reason !== '';

        $payload = json_encode([
            'event_id' => 'cli-'.bin2hex(random_bytes(8)),
            'reference' => $payment->provider_reference,
            'status' => $failing ? PaymentStatus::Failed->value : PaymentStatus::Succeeded->value,
            'reason' => $failing ? $reason : null,
            'fee' => (int) $this->option('fee'),
        ], JSON_THROW_ON_ERROR);

        $controller(
            Request::create(
                '/api/v1/webhooks/payments/fake',
                'POST',
                [],
                [],
                [],
                ['CONTENT_TYPE' => 'application/json'],
                $payload,
            ),
            'fake',
            $gateway,
            $confirm,
            $confirmRefund,
        );

        return $this->report($payment);
    }

    /** Le paiement visé, ou `null` avec l'explication déjà affichée. */
    private function locate(): ?Payment
    {
        $reference = $this->argument('subject');

        $query = Payment::query()
            ->whereIn('status', [PaymentStatus::Pending->value, PaymentStatus::Processing->value])
            ->whereNotNull('provider_reference')
            ->latest('id');

        if (is_string($reference) && $reference !== '') {
            /*
             * Réservation **ou** course : un paiement porte l'une ou l'autre, jamais
             * les deux (contrainte de base). Ne chercher que du côté réservation
             * rendait tout le circuit d'argent d'un appel de service impossible à
             * confirmer en local — donc impossible à exercer.
             */
            $query->where(function ($outer) use ($reference): void {
                $outer
                    ->whereHas('booking', fn ($booking) => $booking->where('reference', $reference))
                    ->orWhereHas('ride', fn ($ride) => $ride->where('reference', $reference));
            });
        }

        $payment = $query->first();

        if ($payment !== null) {
            return $payment;
        }

        $this->error(
            is_string($reference) && $reference !== ''
                ? "Aucun paiement en attente sur {$reference}."
                : 'Aucun paiement en attente. Lancez le paiement depuis le téléphone d\'abord.',
        );

        return null;
    }

    /** Relit depuis la base : ce qui compte est ce que le webhook a écrit. */
    private function report(Payment $payment): int
    {
        $fresh = Payment::query()->with(['booking', 'ride'])->find($payment->id);

        if ($fresh === null) {
            $this->error('Paiement introuvable après traitement.');

            return self::FAILURE;
        }

        $booking = $fresh->booking;

        $this->line("Paiement {$fresh->reference} : {$fresh->status->value}");

        if ($booking !== null) {
            $this->line("Réservation {$booking->reference} : {$booking->status->value}");
        }

        $ride = $fresh->ride;

        if ($ride !== null) {
            $this->line("Course {$ride->reference} : {$ride->status->value}");
        }

        if ($fresh->status === PaymentStatus::Failed) {
            $this->line("Motif : {$fresh->failure_reason}");

            // Un échec est un résultat obtenu, pas une commande ratée.
            return self::SUCCESS;
        }

        return $fresh->status === PaymentStatus::Succeeded ? self::SUCCESS : self::FAILURE;
    }
}
