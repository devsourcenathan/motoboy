<?php

declare(strict_types=1);

namespace App\Modules\Tickets\Enums;

enum ValidationMethod: string
{
    case Scan = 'SCAN';

    /**
     * Secours obligatoire (B3 du brief) : caméra défaillante, QR abîmé sur un
     * billet imprimé, écran fissuré. Une agence bloquée à la porte de son car
     * un vendredi soir n'utilise plus jamais le système.
     */
    case Manual = 'MANUAL';
}
