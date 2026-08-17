<?php

declare(strict_types=1);

namespace App\Modules\Payouts\Models;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Identity\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Coordonnées de reversement.
 *
 * Le changement de ces coordonnées est un vecteur de fraude classique —
 * compromission du compte agence, modification du numéro, attente du jour de
 * paie. Toute création ou modification passe par l'administration, est
 * journalisée et notifiée à l'agence (B4).
 */
final class PayoutAccount extends Model
{
    protected $fillable = [
        'payee_id', 'agency_id', 'type', 'operator', 'account_number', 'account_name',
        'verified_by', 'verified_at', 'is_active',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'verified_at' => 'immutable_datetime',
        'is_active' => 'boolean',
    ];

    /**
     * Pont transitoire vers le beneficiaire — meme forme que dans le grand
     * livre. Les appelants ne passent encore que l'agence, alors que `payee_id`
     * est obligatoire depuis la generalisation.
     *
     * **A retirer** avec les autres ponts, quand les appelants passeront le
     * beneficiaire eux-memes.
     */
    protected static function booted(): void
    {
        self::creating(function (self $account): void {
            // Aucun appelant ne renseigne les deux : la presence d'une agence
            // suffit a decider. Un compte de chauffeur arrive avec son
            // beneficiaire et sans agence, et ne passe donc pas ici.
            if ($account->agency_id !== null) {
                $account->payee()->associate(Payee::forAgency($account->agency_id));
            }
        });
    }

    /** @return BelongsTo<Payee, $this> */
    public function payee(): BelongsTo
    {
        return $this->belongsTo(Payee::class);
    }

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /** @return BelongsTo<User, $this> */
    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    /**
     * La vérification est **obligatoire avant tout décaissement** : une erreur
     * de saisie envoie l'argent à un inconnu, sans recours.
     *
     * @param Builder<$this> $query
     */
    public function scopePayable(Builder $query): void
    {
        $query->where('is_active', true)->whereNotNull('verified_at');
    }
}
