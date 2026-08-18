<?php

declare(strict_types=1);

namespace App\Modules\Payments\Gateways;

use App\Modules\Payments\Contracts\PaymentGateway;
use App\Modules\Payments\Data\GatewayCharge;
use App\Modules\Payments\Data\GatewayRefund;
use App\Modules\Payments\Data\GatewayTransaction;
use App\Modules\Payments\Data\PaymentIntent;
use App\Modules\Payments\Data\RefundIntent;
use App\Modules\Payments\Data\WebhookEvent;
use App\Modules\Payments\Enums\PaymentStatus;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Encaissement Mobile Money par NotchPay (MTN et Orange Cameroun).
 *
 * Documentation : https://developer.notchpay.co/ — lue le 18 aout 2026.
 *
 * **Retenu contre Tranzak pour une seule raison, et elle est decisive** : la
 * verification des webhooks est documentee. En-tete `x-notch-signature`, HMAC
 * SHA-256 du corps brut, cle de hachage du compte. Tranzak mentionne un `authKey`
 * sans dire ce qu'on en fait, et un webhook invérifiable laisse quiconque connait
 * l'URL declarer un paiement reussi.
 *
 * **L'encaissement se fait en deux appels**, et les deux doivent aboutir : on
 * cree d'abord le paiement, puis on declenche le prelevement sur le numero. Le
 * premier seul ne debite rien — il ouvre une transaction que personne ne paierait.
 */
final class NotchPayGateway implements PaymentGateway
{
    /** Les deux canaux du pays, tels que NotchPay les nomme. */
    private const CHANNELS = [
        'MTN' => 'cm.mtn',
        'ORANGE' => 'cm.orange',
    ];

    /**
     * **Trois cles, trois roles distincts** — leur tableau de bord les distingue,
     * et les confondre casse a des endroits differents :
     *
     * - la **publique** (`pk_`) autorise les operations sans donnee sensible, dont
     *   la creation d'un paiement. C'est celle qui voyage en `Authorization` ;
     * - la **privee** (`sk_`) ouvre les operations sensibles — virements, compte,
     *   gestion des webhooks — par l'en-tete `X-Grant`. Elle ne doit jamais
     *   quitter le serveur ;
     * - la **cle de hachage** ne sert qu'a verifier les webhooks. Elle n'est
     *   envoyee nulle part : on l'utilise pour recalculer un condensat.
     */
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $publicKey,
        private readonly string $privateKey,
        private readonly string $webhookHash,
        private readonly int $timeoutSeconds = 20,
    ) {}

    public function name(): string
    {
        return 'notchpay';
    }

    public function charge(PaymentIntent $intent): GatewayCharge
    {
        $channel = self::CHANNELS[$intent->operator ?? ''] ?? null;

        if ($channel === null) {
            /*
             * Refuse avant tout appel : sans canal, NotchPay redirigerait le
             * passager vers une page de choix, alors que le parcours mobile
             * suppose un prelevement direct sur son numero.
             */
            return GatewayCharge::rejected('Opérateur non pris en charge : '.($intent->operator ?? 'aucun'));
        }

        try {
            $created = $this->post('/payments', [
                'amount' => $intent->amount,
                'currency' => $intent->currency,
                'phone' => $intent->payerPhone,
                // Notre reference voyage jusqu'au webhook : c'est elle qui
                // permettra de rapprocher sans dependre de leur identifiant.
                'reference' => $intent->reference,
                'description' => 'MOTOBOY '.$intent->reference,
            ]);

            $reference = $this->transactionOf($this->body($created));

            if (!$created->successful() || $reference === null) {
                /*
                 * Le corps entier est journalise ici. La premiere mise en
                 * production a rendu « Payment initialized » comme motif d'echec —
                 * c'est-a-dire leur message de **succes** : l'appel avait abouti
                 * et c'est la lecture de la reference qui avait echoue. Sans le
                 * corps sous les yeux, ce genre d'erreur se devine.
                 */
                Log::warning('NotchPay : création de paiement inexploitable.', [
                    'status' => $created->status(),
                    'body' => $this->body($created),
                ]);

                return GatewayCharge::rejected($this->errorOf($this->body($created), $created->status()));
            }

            /*
             * Second appel : c'est **lui** qui envoie la sollicitation sur le
             * telephone. S'arreter au premier laisserait une transaction ouverte
             * que personne ne paierait, et un passager devant un ecran qui attend.
             */
            $charged = $this->post('/payments/'.$reference, [
                'channel' => $channel,
                'data' => ['account_number' => $intent->payerPhone],
            ]);

            if (!$charged->successful()) {
                return GatewayCharge::rejected($this->errorOf($this->body($charged), $charged->status()));
            }

            return GatewayCharge::pending($reference);
        } catch (Throwable $cause) {
            return GatewayCharge::rejected('Agrégateur injoignable : '.$cause->getMessage());
        }
    }

    public function refund(RefundIntent $intent): GatewayRefund
    {
        /*
         * Leur documentation decrit des remboursements, mais pas le chemin d'API
         * exact. Tant qu'il n'est pas lu, on refuse : rendre un succes dirait a un
         * passager qu'il est rembourse alors que rien n'aurait bouge, et
         * `RetryFailedRefunds` garde l'echec visible.
         */
        Log::error('NotchPay : remboursement non implémenté.', [
            'refund' => $intent->reference,
            'payment' => $intent->paymentReference,
        ]);

        return GatewayRefund::rejected(
            'Remboursement automatique indisponible : à traiter manuellement.',
        );
    }

    /**
     * Lit un webhook, **apres avoir prouve qu'il vient de NotchPay**.
     *
     * HMAC SHA-256 du corps **brut** — pas du JSON re-encode : re-serialiser
     * changerait un espace ou l'ordre des cles, et le condensat ne
     * correspondrait plus.
     *
     * La comparaison est a temps constant (`hash_equals`), comme leur
     * documentation le demande : un `===` fuit, par sa duree, le nombre de
     * caracteres corrects, ce qui permet de reconstituer une signature valide
     * essai apres essai.
     */
    public function parseWebhook(string $payload, array $headers): ?WebhookEvent
    {
        $signature = $this->headerOf($headers, 'x-notch-signature');
        $expected = hash_hmac('sha256', $payload, $this->webhookHash);

        if ($signature === null || !hash_equals($expected, $signature)) {
            Log::warning('NotchPay : signature de webhook invalide.', [
                'present' => $signature !== null,
            ]);

            /*
             * `signatureValid: false` plutot que `null` : l'evenement remonte
             * jusqu'a `ConfirmPayment`, qui le rejette **et le journalise**. Le
             * taire ferait disparaitre une tentative de fraude.
             */
            return new WebhookEvent(
                eventId: 'non-verifie',
                providerReference: '',
                status: PaymentStatus::Failed,
                failureReason: 'Signature invalide.',
                signatureValid: false,
            );
        }

        $decoded = json_decode($payload, true);
        $decoded = is_array($decoded) ? $decoded : [];

        $data = is_array($decoded['data'] ?? null) ? $decoded['data'] : $decoded;
        $reference = $this->stringOf($data, 'merchant_reference')
            ?? $this->stringOf($data, 'reference')
            ?? $this->stringOf($data, 'transaction');

        if ($reference === null) {
            return null;
        }

        $event = $this->stringOf($decoded, 'event') ?? '';

        return new WebhookEvent(
            eventId: $this->stringOf($decoded, 'id') ?? $reference,
            providerReference: $reference,
            status: $this->statusOf($event, $this->stringOf($data, 'status')),
            failureReason: $event === 'payment.failed'
                ? ($this->stringOf($data, 'message') ?? 'Paiement refusé.')
                : null,
        );
    }

    /**
     * @return list<GatewayTransaction>
     */
    public function listTransactions(CarbonImmutable $from, CarbonImmutable $to): array
    {
        // Le rapprochement se fera quand leur endpoint de liste aura ete lu.
        // Rendre vide plutot qu'inventer un chemin.
        return [];
    }

    /**
     * La reference de transaction, quelle que soit la forme rendue.
     *
     * Leur documentation annonce `transaction` comme une chaine. Ce n'en est pas
     * toujours une : la reponse peut l'imbriquer dans un objet. Lire les deux
     * formes coute trois lignes ; ne lire que l'une refusait un paiement pourtant
     * accepte, avec leur message de succes en guise de motif d'echec.
     *
     * @param  array<string, mixed>  $body
     */
    private function transactionOf(array $body): ?string
    {
        $direct = $this->stringOf($body, 'transaction');

        if ($direct !== null) {
            return $direct;
        }

        $nested = $body['transaction'] ?? null;

        if (is_array($nested)) {
            return $this->stringOf($nested, 'reference') ?? $this->stringOf($nested, 'id');
        }

        // Certaines reponses portent la reference a la racine.
        return $this->stringOf($body, 'reference');
    }

    /**
     * Traduit leur vocabulaire dans le notre.
     *
     * L'evenement fait foi sur le statut : `payment.complete` est plus sur que le
     * champ `status`, qui peut refleter un etat intermediaire au moment de
     * l'envoi.
     */
    private function statusOf(string $event, ?string $status): PaymentStatus
    {
        if ($event === 'payment.complete' || $status === 'complete') {
            return PaymentStatus::Succeeded;
        }

        if ($event === 'payment.failed' || $status === 'failed') {
            return PaymentStatus::Failed;
        }

        return PaymentStatus::Processing;
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function post(string $path, array $body): Response
    {
        return Http::acceptJson()
            ->withHeaders([
                'Authorization' => $this->publicKey,
                /*
                 * La cle privee accompagne chaque appel serveur : elle est ce qui
                 * autorisera les virements et la gestion des webhooks. L'ajouter
                 * ici plutot qu'au cas par cas evite de decouvrir son absence sur
                 * un decaissement, c'est-a-dire au pire moment.
                 */
                'X-Grant' => $this->privateKey,
            ])
            ->timeout($this->timeoutSeconds)
            ->post(rtrim($this->baseUrl, '/').$path, $body);
    }

    /** @return array<string, mixed> */
    private function body(Response $response): array
    {
        $json = $response->json();

        return is_array($json) ? $json : [];
    }

    /**
     * L'en-tete, quelle que soit sa casse.
     *
     * PSR-7 les rend en listes et les serveurs n'accordent pas la casse : chercher
     * `x-notch-signature` a l'identique echouerait sur `X-Notch-Signature`, et le
     * webhook serait refuse pour une raison sans rapport avec sa validite.
     *
     * @param  array<string, list<string|null>>  $headers
     */
    private function headerOf(array $headers, string $name): ?string
    {
        foreach ($headers as $key => $values) {
            if (strtolower($key) !== $name) {
                continue;
            }

            // Toujours une liste : le contrat le dit, et PSR-7 le garantit.
            $value = $values[0] ?? null;

            return is_string($value) && $value !== '' ? $value : null;
        }

        return null;
    }

    /** @param array<string, mixed> $data */
    private function stringOf(array $data, string $key): ?string
    {
        $value = $data[$key] ?? null;

        return is_string($value) && $value !== '' ? $value : null;
    }

    /** @param array<string, mixed> $data */
    private function errorOf(array $data, int $status): string
    {
        return $this->stringOf($data, 'message')
            ?? "Refus de l'agrégateur ({$status}).";
    }
}
