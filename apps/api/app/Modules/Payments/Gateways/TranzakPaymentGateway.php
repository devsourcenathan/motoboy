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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Encaissement Mobile Money par Tranzak (MTN et Orange Cameroun).
 *
 * Documentation : https://docs.developer.tranzak.me/ — lue le 18 aout 2026.
 *
 * **Rien ne s'encaisse de facon synchrone.** `create-mobile-wallet-charge` rend
 * une demande en attente ; le passager recoit une sollicitation sur son telephone
 * et y saisit son code. Le denouement arrive par webhook, et c'est lui qui fait
 * foi — jamais la reponse de creation.
 */
final class TranzakPaymentGateway implements PaymentGateway
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $appId,
        private readonly string $appKey,
        private readonly int $timeoutSeconds = 20,
    ) {}

    public function name(): string
    {
        return 'tranzak';
    }

    public function charge(PaymentIntent $intent): GatewayCharge
    {
        try {
            $response = $this->post('/xp021/v1/request/create-mobile-wallet-charge', [
                'amount' => $intent->amount,
                'currencyCode' => $intent->currency,
                'description' => 'MOTOBOY '.$intent->reference,
                /*
                 * Tranzak attend le numero **avec l'indicatif et sans `+`**
                 * (237680657567 dans leur exemple). La plateforme stocke la forme
                 * internationale : on retire le signe plutot que de supposer que
                 * les deux formes se valent.
                 */
                'mobileWalletNumber' => ltrim($intent->payerPhone ?? '', '+'),
                // Notre reference, pour le rapprochement. Trente-deux caracteres
                // au plus et unique sur trente jours, ce que `PAY-XXXXXX` respecte.
                'mchTransactionRef' => $intent->reference,
            ]);
        } catch (Throwable $cause) {
            return GatewayCharge::rejected('Agrégateur injoignable : '.$cause->getMessage());
        }

        $data = $this->payload($response->json());

        if (!$response->successful()) {
            return GatewayCharge::rejected($this->errorOf($data, $response->status()));
        }

        $providerReference = $this->stringOf($data, 'requestId') ?? $this->stringOf($data, 'transactionId');

        if ($providerReference === null) {
            /*
             * Sans reference du prestataire, le webhook n'aura rien a quoi se
             * raccrocher : mieux vaut refuser tout de suite que d'accepter un
             * paiement qu'on ne saura jamais rapprocher.
             */
            return GatewayCharge::rejected('Réponse sans référence de transaction.');
        }

        return GatewayCharge::pending($providerReference);
    }

    public function refund(RefundIntent $intent): GatewayRefund
    {
        /*
         * **Non implemente, et refuse explicitement.**
         *
         * Leur documentation ne decrit pas d'endpoint de remboursement — le
         * statut `CANCELLED/REFUNDED` existe cote transaction, sans geste pour le
         * declencher. Rendre un succes ici ferait croire a un passager qu'il est
         * rembourse alors que rien ne serait parti ; `RetryFailedRefunds`
         * reessaiera, et l'echec restera visible.
         */
        Log::error('Tranzak : remboursement non implémenté.', [
            'refund' => $intent->reference,
            'payment' => $intent->paymentReference,
        ]);

        return GatewayRefund::rejected(
            'Remboursement automatique indisponible : à traiter manuellement avec Tranzak.',
        );
    }

    /**
     * ⚠️ **Refuse tout, tant que la verification n'est pas connue.**
     *
     * Leur documentation mentionne un champ `authKey` qui « peut servir a
     * verifier que la charge provient des serveurs Tranzak », sans dire comment :
     * ni en-tete, ni algorithme, ni ce qui est signe.
     *
     * Accepter en attendant reviendrait a laisser quiconque connait l'URL
     * declarer un paiement reussi — et le webhook emet un billet, puis credite un
     * chauffeur. On echoue donc **ferme** : `signatureValid: false` fait rejeter
     * l'evenement par `ConfirmPayment`, et le paiement reste en attente, ce qui
     * se rattrape. L'inverse ne se rattrape pas.
     */
    public function parseWebhook(string $payload, array $headers): WebhookEvent
    {
        Log::warning('Tranzak : webhook reçu mais non vérifiable.', [
            'reason' => 'Schéma de signature non documenté — voir TRANZAK_WEBHOOK_SECRET.',
            'headers' => array_keys($headers),
        ]);

        $data = $this->payload(json_decode($payload, true));

        return new WebhookEvent(
            eventId: $this->stringOf($data, 'eventId') ?? 'inconnu',
            providerReference: $this->stringOf($data, 'requestId') ?? '',
            status: PaymentStatus::Pending,
            failureReason: 'Signature non vérifiée.',
            signatureValid: false,
        );
    }

    /**
     * @return list<GatewayTransaction>
     */
    public function listTransactions(CarbonImmutable $from, CarbonImmutable $to): array
    {
        // Aucun endpoint de rapprochement documente. Rendre une liste vide
        // plutot qu'inventer un chemin : le rapprochement se fera au tableau de
        // bord Tranzak en attendant.
        return [];
    }

    /**
     * Le jeton, mis en cache.
     *
     * Leur documentation conseille de le garder les trois quarts de sa validite.
     * En redemander un a chaque appel doublerait le nombre de requetes sur la
     * connexion la plus mauvaise du parcours, et l'endpoint d'authentification
     * est le plus lent des deux.
     */
    private function token(): string
    {
        $key = 'tranzak.token.'.md5($this->appId);

        $cached = Cache::get($key);

        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        $response = Http::acceptJson()
            ->timeout($this->timeoutSeconds)
            ->post(rtrim($this->baseUrl, '/').'/auth/token', [
                'appId' => $this->appId,
                'appKey' => $this->appKey,
            ]);

        $data = $this->payload($response->json());
        $token = $this->stringOf($data, 'token');

        if (!$response->successful() || $token === null) {
            throw new \RuntimeException('Authentification Tranzak refusée.');
        }

        $expires = $data['expiresIn'] ?? null;
        $seconds = is_numeric($expires) ? (int) $expires : 3600;

        Cache::put($key, $token, (int) max(60, $seconds * 3 / 4));

        return $token;
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function post(string $path, array $body): Response
    {
        return Http::acceptJson()
            ->withToken($this->token())
            // Leur documentation le mentionne comme facultatif ; l'envoyer coute
            // un en-tete et facilite leur support en cas d'incident.
            ->withHeaders(['X-App-ID' => $this->appId])
            ->timeout($this->timeoutSeconds)
            ->post(rtrim($this->baseUrl, '/').$path, $body);
    }

    /**
     * Le contenu utile d'une reponse.
     *
     * Leur API enveloppe le resultat dans `data` ; on retombe sur la racine quand
     * l'enveloppe est absente, plutot que de rendre un tableau vide qui ferait
     * echouer la lecture sans dire pourquoi.
     *
     * @return array<string, mixed>
     */
    private function payload(mixed $json): array
    {
        if (!is_array($json)) {
            return [];
        }

        $data = $json['data'] ?? null;

        return is_array($data) ? $data : $json;
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
            ?? $this->stringOf($data, 'errorMsg')
            ?? "Refus de l'agrégateur ({$status}).";
    }
}
