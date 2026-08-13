<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

/**
 * Un OTP est lié à son intention.
 *
 * Un code demandé pour se connecter ne doit pas pouvoir valider une
 * inscription : sans cette séparation, un code intercepté sur un canal servirait
 * sur l'autre.
 */
enum OtpPurpose: string
{
    case Registration = 'REGISTRATION';
    case Login = 'LOGIN';
    case PhoneChange = 'PHONE_CHANGE';
}
