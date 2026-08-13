<?php

declare(strict_types=1);

namespace App\Modules\Payments\Enums;

enum PaymentMethod: string
{
    public function usesAggregator(): bool
    {
        return $this !== self::Cash;
    }
    case MobileMoney = 'MOBILE_MONEY';
    case Card = 'CARD';

    /**
     * Vente au guichet (I2 du brief) : encaissée en espèces par l'agence, elle
     * ne transite jamais par l'agrégateur mais alimente les statistiques et le
     * compte courant.
     */
    case Cash = 'CASH';
}
