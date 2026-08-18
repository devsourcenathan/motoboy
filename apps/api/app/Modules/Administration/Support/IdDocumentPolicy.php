<?php

declare(strict_types=1);

namespace App\Modules\Administration\Support;

use App\Modules\Administration\Models\PlatformSetting;
use App\Modules\Identity\Models\User;

/**
 * La piece d'identite demandee au voyageur principal.
 *
 * **Deux reglages, parce que deux questions distinctes se posent.** Quelle forme
 * — un numero saisi, ou une photo de la piece ? Et faut-il bloquer la reservation
 * quand elle manque ? Les fondre en un seul reglage a trois valeurs obligerait a
 * choisir entre « photo facultative » et « numero obligatoire » alors que les
 * quatre combinaisons ont un sens sur le terrain.
 *
 * Reglables depuis le dashboard, comme la commission : ce que le manifeste exige
 * varie d'une region a l'autre et d'un controle a l'autre, et un deploiement par
 * ajustement ferait qu'on n'ajusterait pas.
 *
 * **Le voyageur principal seulement.** Demander la piece des quatre passagers
 * d'une famille transformerait une reservation en formalite administrative, pour
 * une liste d'embarquement qui identifie deja le groupe par son acheteur.
 */
final class IdDocumentPolicy
{
    public const MODE_KEY = 'bookings.id_document_mode';

    public const REQUIRED_KEY = 'bookings.id_document_required';

    public const MODE_NUMBER = 'NUMBER';

    public const MODE_IMAGE = 'IMAGE';

    /**
     * Le numero par defaut.
     *
     * Il se saisit hors ligne, sur n'importe quel telephone, et ne coute ni
     * stockage ni conservation. La photo se justifie quand un controle reel
     * l'exige — c'est alors une decision, pas un defaut qu'on subit.
     */
    public const DEFAULT_MODE = self::MODE_NUMBER;

    /**
     * Exigee par defaut, puisque c'est ce que le manifeste demande.
     *
     * Le reglage existe pour l'inverse : une agence dont les controles ne
     * l'exigent pas ne doit pas ecarter des voyageurs reels pour une piece que
     * personne ne lira.
     */
    public const DEFAULT_REQUIRED = true;

    public function mode(): string
    {
        $value = PlatformSetting::query()->where('key', self::MODE_KEY)->value('value');

        // Une valeur inconnue — saisie manuelle en base, reglage d'une version
        // future — retombe sur le defaut plutot que de fermer la reservation.
        return in_array($value, [self::MODE_NUMBER, self::MODE_IMAGE], true)
            ? $value
            : self::DEFAULT_MODE;
    }

    public function isRequired(): bool
    {
        $value = PlatformSetting::query()->where('key', self::REQUIRED_KEY)->value('value');

        if (!is_string($value)) {
            return self::DEFAULT_REQUIRED;
        }

        return $value === '1' || $value === 'true';
    }

    public function updateMode(string $mode, User $actor): string
    {
        $bounded = in_array($mode, [self::MODE_NUMBER, self::MODE_IMAGE], true)
            ? $mode
            : self::DEFAULT_MODE;

        PlatformSetting::query()->updateOrCreate(
            ['key' => self::MODE_KEY],
            ['value' => $bounded, 'updated_by' => $actor->id],
        );

        return $bounded;
    }

    public function updateRequired(bool $required, User $actor): bool
    {
        PlatformSetting::query()->updateOrCreate(
            ['key' => self::REQUIRED_KEY],
            ['value' => $required ? '1' : '0', 'updated_by' => $actor->id],
        );

        return $required;
    }
}
