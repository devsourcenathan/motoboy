<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Http\Controllers;

use App\Modules\Agencies\Support\AgencyContext;
use App\Modules\Payouts\Http\Resources\PayoutResource;
use App\Modules\Payouts\Models\AgencyLedgerEntry;
use App\Modules\Payouts\Models\Payout;
use App\Modules\Payouts\Models\PayoutLine;
use App\Modules\Payouts\Support\EligibleBalance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Ce que l'agence voit de son argent (B4).
 */
final class AgencyPayoutController
{
    public function __construct(private readonly AgencyContext $context) {}

    public function index(Request $request): JsonResponse
    {
        $agency = $this->context->require($request);
        $perPage = min(max($request->integer('per_page', 20), 1), 100);

        $payouts = Payout::query()
            ->with(['payee.agency', 'payee.user', 'account'])
            ->where('agency_id', $agency->id)
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'data' => PayoutResource::collection($payouts->items())->resolve(),
            'meta' => [
                'page' => $payouts->currentPage(),
                'per_page' => $payouts->perPage(),
                'total' => $payouts->total(),
                'last_page' => $payouts->lastPage(),
            ],
        ]);
    }

    /**
     * Le justificatif : réservations incluses, brut, commission, remboursements
     * déduits, ajustements, net versé, référence du transfert.
     *
     * **C'est ce document qui évite les litiges répétés sur les montants.**
     */
    public function show(Request $request, string $reference): JsonResponse
    {
        $payout = $this->find($request, $reference);

        /** @var array<string, mixed> $summary */
        $summary = (new PayoutResource($payout))->resolve();
        $account = $payout->account;

        return response()->json([
            ...$summary,
            'account' => $account === null ? null : [
                'type' => $account->type,
                'operator' => $account->operator,
                'account_name' => $account->account_name,
                // Tronqué : le numéro complet n'a pas à circuler dans une
                // réponse d'API. Le changer est un vecteur de fraude classique,
                // le lire en est la première étape (B4).
                'masked_number' => $this->mask($account->account_number),
                'verified' => $account->verified_at !== null,
            ],
            'lines' => $this->lines($payout),
        ]);
    }

    /**
     * Le même détail, au format que l'agence ouvre réellement.
     *
     * Un tableur se relit, se trie et se rapproche d'une comptabilité ; un PDF
     * non. Il attendra d'être demandé.
     */
    public function statement(Request $request, string $reference): StreamedResponse
    {
        $payout = $this->find($request, $reference);
        $lines = $this->lines($payout);

        return response()->streamDownload(function () use ($payout, $lines): void {
            $out = fopen('php://output', 'wb');

            if ($out === false) {
                return;
            }

            // BOM UTF-8 : sans lui, Excel affiche « rÃ©servation » sur toute
            // colonne accentuée, et le relevé censé clore un litige en ouvre un.
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, ['Reversement', $payout->reference]);
            fputcsv($out, ['Période', $payout->period_start->toDateString(), $payout->period_end->toDateString()]);
            fputcsv($out, ['Net versé', $payout->net_amount, $payout->currency]);
            fputcsv($out, []);
            fputcsv($out, ['Réservation', 'Départ', 'Date de départ', 'Brut', 'Commission', 'Remboursements', 'Net']);

            foreach ($lines as $line) {
                fputcsv($out, [
                    $line['booking_reference'],
                    $line['trip_reference'],
                    $line['departure_at'],
                    $line['gross']['amount'],
                    $line['commission']['amount'],
                    $line['refunds']['amount'],
                    $line['net']['amount'],
                ]);
            }

            fclose($out);
        }, "releve-{$payout->reference}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Le compte courant, écritures et somme.
     *
     * **Aucun solde n'est stocké** : il se calcule. Un solde dénormalisé finit
     * toujours par diverger de ses écritures, et sur un compte qui détermine
     * combien l'on verse à une agence, la divergence se découvre lors d'une
     * réclamation.
     */
    public function ledger(Request $request): JsonResponse
    {
        $agency = $this->context->require($request);
        $perPage = min(max($request->integer('per_page', 20), 1), 100);

        $entries = AgencyLedgerEntry::query()
            ->where('agency_id', $agency->id)
            ->orderByDesc('occurred_at')
            ->paginate($perPage);

        $currency = 'XAF';
        $balance = (int) AgencyLedgerEntry::query()->where('agency_id', $agency->id)->sum('amount');
        $terms = $agency->commercialTerms;
        $delay = $terms === null ? 24 : $terms->payout_delay_hours;

        return response()->json([
            'data' => array_map(fn (AgencyLedgerEntry $entry): array => [
                'type' => $entry->type,
                'amount' => ['amount' => (int) $entry->amount, 'currency' => $entry->currency],
                'description' => $entry->description,
                'reference_type' => $entry->reference_type,
                'occurred_at' => $entry->occurred_at?->toIso8601String(),
            ], $entries->items()),
            'balance' => ['amount' => $balance, 'currency' => $currency],
            'eligible_balance' => [
                'amount' => EligibleBalance::amount($agency->id, $delay),
                'currency' => $currency,
            ],
            'meta' => [
                'page' => $entries->currentPage(),
                'per_page' => $entries->perPage(),
                'total' => $entries->total(),
                'last_page' => $entries->lastPage(),
            ],
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function lines(Payout $payout): array
    {
        $lines = $payout->lines()
            ->with('booking.trip')
            ->get()
            ->map(fn (PayoutLine $line): array => [
                'booking_reference' => $line->booking?->reference,
                'trip_reference' => $line->booking?->trip?->reference,
                'departure_at' => $line->booking?->trip?->departure_at?->toIso8601String(),
                'gross' => ['amount' => $line->gross_amount, 'currency' => $payout->currency],
                'commission' => ['amount' => $line->commission_amount, 'currency' => $payout->currency],
                'refunds' => ['amount' => $line->refund_amount, 'currency' => $payout->currency],
                'net' => ['amount' => $line->net_amount, 'currency' => $payout->currency],
            ])
            ->all();

        return array_values($lines);
    }

    private function find(Request $request, string $reference): Payout
    {
        $agency = $this->context->require($request);

        $payout = Payout::query()
            ->where('reference', $reference)
            ->with('account')
            ->firstOrFail();

        $this->context->own($agency, $payout->agency_id);

        return $payout;
    }

    private function mask(string $number): string
    {
        $tail = mb_substr($number, -3);

        return str_repeat('•', max(0, mb_strlen($number) - 3)).$tail;
    }
}
