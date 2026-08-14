<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\Locale;
use App\Modules\Identity\Enums\OtpPurpose;
use App\Modules\Identity\Models\OtpCode;
use App\Modules\Notifications\Contracts\SmsSender;
use App\Modules\Notifications\Data\SmsMessage;
use App\Modules\Notifications\Models\Notification;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Génère et envoie un code à usage unique.
 *
 * Règles de §8 : validité 10 minutes, 4 tentatives au maximum.
 */
final class SendOtp
{
    public function __construct(private readonly SmsSender $sms) {}

    public function handle(string $phone, OtpPurpose $purpose, Locale $locale): OtpCode
    {
        $this->guardAgainstFlooding($phone);

        return DB::transaction(function () use ($phone, $purpose, $locale): OtpCode {
            // Un seul code vivant par intention : demander un nouveau code
            // invalide le précédent, sinon deux codes valides circuleraient et
            // le plus ancien resterait exploitable après un renvoi.
            OtpCode::query()
                ->where('phone', $phone)
                ->where('purpose', $purpose->value)
                ->whereNull('consumed_at')
                ->update(['consumed_at' => now()]);

            $code = $this->generateCode();

            $otp = OtpCode::query()->create([
                'phone' => $phone,
                // Stocké haché : un accès en lecture à la base ne doit pas
                // permettre de prendre la main sur un compte.
                'code_hash' => Hash::make($code),
                'purpose' => $purpose->value,
                'expires_at' => now()->addMinutes(OtpCode::LIFETIME_MINUTES),
                'attempts' => 0,
                'created_at' => now(),
            ]);

            $this->dispatch($phone, $code, $locale);

            return $otp;
        });
    }

    /**
     * Le SMS coûte de l'argent et l'OTP est le seul canal sans alternative
     * (I8). Sans cette borne, un script qui redemande un code en boucle vide le
     * budget SMS — c'est une protection de coût autant qu'une protection
     * d'abus.
     */
    private function guardAgainstFlooding(string $phone): void
    {
        $max = (int) config('sms.throttle.per_phone_per_hour');

        $recent = OtpCode::query()
            ->where('phone', $phone)
            ->where('created_at', '>=', now()->subHour())
            ->count();

        if ($recent >= $max) {
            throw ApiException::of(
                ErrorCode::RateLimited,
                "Plus de {$max} codes demandés en une heure pour ce numéro.",
                ['retry_after' => 3600],
            );
        }
    }

    /**
     * Six chiffres, tirés d'une source cryptographique.
     *
     * `random_int` et non `rand` : un code prédictible ne protège rien, et c'est
     * le seul facteur d'authentification du passager.
     */
    private function generateCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    private function dispatch(string $phone, string $code, Locale $locale): void
    {
        $body = trans('sms.otp', [
            'code' => $code,
            'minutes' => OtpCode::LIFETIME_MINUTES,
        ], $locale->value);

        $result = $this->sms->send(new SmsMessage(
            to: $phone,
            body: is_string($body) ? $body : '',
            locale: $locale,
            type: 'OTP',
        ));

        // Le code n'est **jamais** consigné dans le journal des notifications :
        // c'est un secret, et cette table est consultée en exploitation.
        Notification::query()->create([
            'phone' => $phone,
            'channel' => 'SMS',
            'locale' => $locale,
            'type' => 'OTP',
            'payload' => ['purpose' => 'authentication'],
            'status' => $result->delivered ? 'SENT' : 'FAILED',
            'provider_reference' => $result->providerReference,
            'sent_at' => $result->delivered ? now() : null,
            'error' => $result->error,
        ]);
    }
}
