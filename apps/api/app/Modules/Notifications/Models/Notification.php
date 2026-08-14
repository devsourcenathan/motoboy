<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Identity\Enums\Locale;
use App\Modules\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Notification envoyée.
 *
 * `locale` trace la langue **effectivement utilisée**, parce que sa résolution
 * dépend du destinataire : `users.locale` pour un compte, langue par défaut de
 * l'agence pour un passager de vente au guichet, qui n'en a pas (I10).
 *
 * Le canal est arbitré par le coût du SMS (I8) : OTP et annulation par l'agence
 * partent systématiquement en SMS, la confirmation en push avec repli SMS, le
 * rappel de départ en push seulement.
 */
final class Notification extends Model
{
    protected $fillable = [
        'user_id', 'phone', 'channel', 'locale', 'type', 'payload',
        'status', 'provider_reference', 'sent_at', 'error',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'locale' => Locale::class,
        'payload' => 'array',
        'sent_at' => 'immutable_datetime',
    ];

    /**
     * Null pour un passager de vente au guichet.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
