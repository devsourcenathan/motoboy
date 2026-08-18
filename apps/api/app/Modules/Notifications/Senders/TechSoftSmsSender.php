<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Senders;

use App\Modules\Notifications\Contracts\SmsSender;
use App\Modules\Notifications\Data\SmsMessage;
use App\Modules\Notifications\Data\SmsResult;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Envoi de SMS par TechSoft.
 *
 * Documentation : https://app.techsoft-sms.com/developers/http-docs — section
 * SMS, lue le 18 aout 2026.
 *
 * **Le jeton voyage dans le corps, pas dans un en-tete.** C'est inhabituel et
 * c'est ce que leur API demande (`api_token`). Consequence a garder en tete : il
 * ne faut jamais journaliser la charge utile telle quelle, sinon la cle se
 * retrouve en clair dans les journaux.
 *
 * **Un envoi accepte n'est pas un SMS recu.** L'API rend un identifiant de
 * message ; la remise reelle depend de l'operateur et peut echouer plus tard.
 * `SmsResult::sent()` dit donc « pris en charge », pas « arrive » — et c'est
 * suffisant pour l'OTP, ou le passager redemande un code s'il ne le voit pas.
 */
final class TechSoftSmsSender implements SmsSender
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $apiToken,
        private readonly string $senderId,
        private readonly int $timeoutSeconds = 10,
    ) {}

    public function send(SmsMessage $message): SmsResult
    {
        try {
            $response = Http::acceptJson()
                /*
                 * Dix secondes : l'OTP est envoye pendant que le passager attend
                 * devant son ecran. Au-dela, mieux vaut lui rendre la main et le
                 * laisser redemander un code que de le faire patienter sur une
                 * requete qui n'aboutira peut-etre pas.
                 */
                ->timeout($this->timeoutSeconds)
                ->post(rtrim($this->baseUrl, '/').'/sms/send', [
                    'api_token' => $this->apiToken,
                    // Le numero tel que la plateforme le stocke, au format
                    // international. Leur exemple montre des numeros sans `+` ;
                    // a verifier au premier envoi reel.
                    'recipient' => $message->to,
                    'sender_id' => $this->senderId,
                    // `plain` : le seul type utile ici. Les modeles DLT ne
                    // concernent pas le Cameroun.
                    'type' => 'plain',
                    'message' => $message->body,
                ]);
        } catch (Throwable $cause) {
            /*
             * Une panne reseau n'est pas une erreur de l'appelant : `SendOtp`
             * decidera de reessayer. On la nomme sans laisser fuiter le jeton,
             * qui se trouve dans la charge utile.
             */
            Log::warning('SMS TechSoft : appel impossible.', [
                'to' => $message->to,
                'type' => $message->type,
                'reason' => $cause->getMessage(),
            ]);

            return SmsResult::failed('Prestataire injoignable.');
        }

        $body = $response->json();
        $body = is_array($body) ? $body : [];

        if (!$response->successful() || ($body['status'] ?? null) !== 'success') {
            $error = is_string($body['message'] ?? null)
                ? $body['message']
                : 'Refus du prestataire ('.$response->status().').';

            Log::warning('SMS TechSoft : envoi refuse.', [
                'to' => $message->to,
                'type' => $message->type,
                'status' => $response->status(),
                'error' => $error,
            ]);

            return SmsResult::failed($error);
        }

        /*
         * `data` est une **liste** : l'API accepte plusieurs destinataires en une
         * fois. On n'en envoie qu'un, donc la premiere entree est la notre — mais
         * on la lit sans supposer qu'elle existe, un corps vide restant possible.
         */
        $first = $body['data'][0] ?? null;
        $uid = is_array($first) && is_string($first['uid'] ?? null) ? $first['uid'] : null;

        return SmsResult::sent($uid);
    }
}
