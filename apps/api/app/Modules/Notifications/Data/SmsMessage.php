<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

use App\Modules\Identity\Enums\Locale;

final readonly class SmsMessage
{
    public function __construct(
        /** Format E.164, tel que stocké. */
        public string $to,
        public string $body,
        /**
         * Langue du destinataire, tracée avec l'envoi : la résolution dépend du
         * destinataire — compte, ou langue par défaut de l'agence pour un
         * passager de vente au guichet (I10).
         */
        public Locale $locale,
        /** Type métier, pour la traçabilité et le suivi de coût. */
        public string $type,
    ) {}
}
