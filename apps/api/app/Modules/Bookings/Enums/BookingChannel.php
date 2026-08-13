<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Enums;

/**
 * Par où la réservation est entrée.
 *
 * La distinction n'est pas cosmétique : elle décide du flux d'argent. Une vente
 * en ligne est encaissée par la plateforme puis reversée à l'agence ; une vente
 * au guichet est encaissée par l'agence, et la plateforme ne lui doit rien —
 * c'est l'agence qui peut lui devoir une commission (B4, I2).
 */
enum BookingChannel: string
{
    case Online = 'ONLINE';
    case Counter = 'COUNTER';
}
