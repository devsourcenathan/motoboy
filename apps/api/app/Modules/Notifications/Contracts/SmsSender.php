<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Contracts;

use App\Modules\Notifications\Data\SmsMessage;
use App\Modules\Notifications\Data\SmsResult;

/**
 * Port d'envoi de SMS.
 *
 * **Exprimé en vocabulaire métier, jamais en vocabulaire de prestataire** (§7
 * du brief). Aucune notion de jeton, d'identifiant d'expéditeur ou de format de
 * réponse ne remonte ici : c'est ce qui permet d'ajouter ou de changer de
 * fournisseur en écrivant une classe et en changeant une ligne de
 * configuration.
 *
 * Ajouter un fournisseur :
 *   1. une classe implémentant cette interface, dans `Senders/` ;
 *   2. une entrée dans `config/sms.php` ;
 *   3. rien d'autre — aucun appelant ne change.
 */
interface SmsSender
{
    /**
     * Envoie un message.
     *
     * Ne lève pas sur un échec du prestataire : un SMS non parti est un
     * incident d'exploitation, pas une panne applicative. L'échec est porté par
     * le résultat, à charge de l'appelant de décider s'il réessaie ou alerte.
     */
    public function send(SmsMessage $message): SmsResult;
}
