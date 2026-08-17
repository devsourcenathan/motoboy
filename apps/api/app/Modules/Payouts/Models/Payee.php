<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Models;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * À qui la plateforme verse de l'argent.
 *
 * Une agence pour une réservation de départ programmé (B4), un chauffeur
 * indépendant pour un appel de service (E4). Le grand livre et les reversements
 * pointent ici et **cessent de savoir de quel genre il s'agit** : c'est ce qui
 * permet d'ajouter un bénéficiaire sans toucher au code qui compte l'argent.
 *
 * Le genre et la cible sont accordés par une contrainte en base : un `DRIVER`
 * porte un utilisateur et pas d'agence, un `AGENCY` l'inverse. Un bénéficiaire
 * sans destinataire n'est pas représentable.
 */
final class Payee extends Model
{
    public const KIND_AGENCY = 'AGENCY';

    public const KIND_DRIVER = 'DRIVER';

    protected $fillable = ['kind', 'agency_id', 'user_id'];

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Le bénéficiaire d'une agence, créé au besoin.
     *
     * Une agence validée après cette migration n'a pas encore de bénéficiaire ;
     * le créer à la demande évite d'avoir à s'en souvenir dans le parcours de
     * validation, où l'oubli ne se verrait qu'au premier reversement.
     */
    public static function forAgency(int $agencyId): self
    {
        return self::query()->firstOrCreate(
            ['agency_id' => $agencyId],
            ['kind' => self::KIND_AGENCY],
        );
    }

    /** Le bénéficiaire d'un chauffeur indépendant, créé au besoin. */
    public static function forUser(int $userId): self
    {
        return self::query()->firstOrCreate(
            ['user_id' => $userId],
            ['kind' => self::KIND_DRIVER],
        );
    }
}
