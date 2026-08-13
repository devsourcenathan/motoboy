<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Senders;

use App\Modules\Notifications\Contracts\SmsSender;
use App\Modules\Notifications\Data\SmsMessage;
use App\Modules\Notifications\Data\SmsResult;
use Illuminate\Support\Facades\Log;

/**
 * Pilote de développement : le message part dans les journaux.
 *
 * C'est lui qui permet de construire l'inscription par OTP **sans attendre** la
 * documentation du prestataire, et de tester le parcours complet sans dépenser
 * un SMS. En test, il évite aussi qu'un envoi réel parte par accident.
 */
final class LogSmsSender implements SmsSender
{
    public function send(SmsMessage $message): SmsResult
    {
        Log::info('SMS (pilote de journalisation)', [
            'to' => $message->to,
            'type' => $message->type,
            'locale' => $message->locale->value,
            'body' => $message->body,
        ]);

        return SmsResult::sent('log-'.bin2hex(random_bytes(6)));
    }
}
