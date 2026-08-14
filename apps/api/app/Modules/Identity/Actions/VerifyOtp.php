<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\OtpPurpose;
use App\Modules\Identity\Models\OtpCode;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Vérifie un code à usage unique.
 *
 * Trois issues distinctes — invalide, expiré, trop de tentatives — parce qu'un
 * passager bloqué doit savoir s'il doit retaper ou redemander un code. Les
 * confondre transformerait un problème résoluble en abandon.
 *
 * ⚠️ **L'exception est levée hors de la transaction, jamais dedans.**
 * L'incrément du compteur de tentatives et l'échec voyagent ensemble : lever
 * depuis l'intérieur annulerait l'incrément avec le reste, et la limite de
 * quatre tentatives de §8 ne limiterait rien du tout — un attaquant disposerait
 * d'essais illimités sur un code à six chiffres.
 */
final class VerifyOtp
{
    public function handle(string $phone, string $code, OtpPurpose $purpose): void
    {
        $failure = DB::transaction(function () use ($phone, $code, $purpose): ?ApiException {
            // Le verrou évite que deux tentatives simultanées consomment chacune
            // une chance : sans lui, un attaquant paralléliserait ses essais.
            $otp = OtpCode::query()
                ->where('phone', $phone)
                ->where('purpose', $purpose->value)
                ->whereNull('consumed_at')
                ->orderByDesc('id')
                ->lockForUpdate()
                ->first();

            if ($otp === null) {
                return ApiException::of(ErrorCode::OtpExpired, 'Aucun code en attente pour ce numéro.');
            }

            if ($otp->expires_at !== null && $otp->expires_at->isPast()) {
                return ApiException::of(ErrorCode::OtpExpired, 'Code expiré.');
            }

            // Vérifié **avant** la comparaison : une fois la limite atteinte, le
            // code est mort, et répondre « incorrect » laisserait croire qu'un
            // nouvel essai est possible.
            if ($otp->attempts >= OtpCode::MAX_ATTEMPTS) {
                return ApiException::of(
                    ErrorCode::OtpTooManyAttempts,
                    'Nombre de tentatives dépassé pour ce code.',
                );
            }

            if (!Hash::check($code, $otp->code_hash)) {
                $otp->increment('attempts');

                $remaining = OtpCode::MAX_ATTEMPTS - $otp->attempts;

                return ApiException::of(
                    $remaining > 0 ? ErrorCode::OtpInvalid : ErrorCode::OtpTooManyAttempts,
                    'Code incorrect.',
                    ['attempts_remaining' => max(0, $remaining)],
                );
            }

            $otp->update(['consumed_at' => now()]);

            return null;
        });

        if ($failure !== null) {
            throw $failure;
        }
    }
}
