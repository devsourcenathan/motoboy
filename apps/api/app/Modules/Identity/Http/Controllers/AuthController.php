<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\RegisterPassenger;
use App\Modules\Identity\Actions\SendOtp;
use App\Modules\Identity\Actions\VerifyOtp;
use App\Modules\Identity\Enums\Locale;
use App\Modules\Identity\Enums\OtpPurpose;
use App\Modules\Identity\Http\Requests\LoginRequest;
use App\Modules\Identity\Http\Requests\RegisterRequest;
use App\Modules\Identity\Http\Requests\ResendOtpRequest;
use App\Modules\Identity\Http\Requests\VerifyOtpRequest;
use App\Modules\Identity\Http\Resources\UserResource;
use App\Modules\Identity\Models\OtpCode;
use App\Modules\Identity\Models\User;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

final class AuthController
{
    public function register(RegisterRequest $request, RegisterPassenger $register): JsonResponse
    {
        $otp = $register->handle(
            phone: $request->string('phone')->toString(),
            firstName: $request->string('first_name')->toString(),
            lastName: $request->string('last_name')->toString(),
            email: $request->has('email') ? $request->string('email')->toString() : null,
            locale: $request->locale(),
        );

        return self::challenge($otp);
    }

    public function login(LoginRequest $request, SendOtp $sendOtp): JsonResponse
    {
        $user = $this->verifiedUser($request->string('phone')->toString());

        return self::challenge($sendOtp->handle($user->phone, OtpPurpose::Login, $user->locale));
    }

    public function resend(ResendOtpRequest $request, SendOtp $sendOtp): JsonResponse
    {
        $phone = $request->string('phone')->toString();
        $purpose = $request->purpose();

        // La langue suit le compte quand il existe. Sur une inscription en
        // cours, le compte existe déjà mais n'est pas vérifié — sa langue a été
        // choisie à l'inscription et c'est bien celle-là qu'il faut réutiliser.
        $locale = User::query()->where('phone', $phone)->value('locale') ?? Locale::French;

        return self::challenge($sendOtp->handle($phone, $purpose, $locale));
    }

    public function verify(VerifyOtpRequest $request, VerifyOtp $verify): JsonResponse
    {
        $phone = $request->string('phone')->toString();
        $purpose = $request->purpose();

        $verify->handle($phone, $request->string('code')->toString(), $purpose);

        $user = User::query()->where('phone', $phone)->firstOrFail();

        // La vérification du téléphone n'a lieu qu'ici : c'est elle qui rend le
        // compte utilisable, pas sa création (§8).
        if ($user->phone_verified_at === null) {
            $user->forceFill(['phone_verified_at' => now()])->save();
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'token' => $user->createToken('mobile')->plainTextToken,
            'user' => (new UserResource($user))->resolve(),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user instanceof User) {
            throw ApiException::of(ErrorCode::Unauthenticated, 'Session absente.');
        }

        return response()->json((new UserResource($user))->resolve());
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        // Sanctum renvoie un jeton transitoire quand la session porte
        // l'authentification : il n'y a alors rien à révoquer.
        $token = $user instanceof User ? $user->currentAccessToken() : null;

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->json(status: 204);
    }

    private function verifiedUser(string $phone): User
    {
        $user = User::query()->where('phone', $phone)->first();

        if ($user === null || $user->phone_verified_at === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Aucun compte vérifié pour ce numéro.');
        }

        if (!$user->is_active) {
            throw ApiException::of(ErrorCode::Forbidden, 'Ce compte est désactivé.');
        }

        return $user;
    }

    private static function challenge(OtpCode $otp): JsonResponse
    {
        return response()->json([
            'expires_at' => $otp->expires_at?->toIso8601String(),
            'attempts_remaining' => OtpCode::MAX_ATTEMPTS - $otp->attempts,
        ], 202);
    }
}
