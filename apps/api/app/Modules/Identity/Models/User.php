<?php

declare(strict_types=1);

namespace App\Modules\Identity\Models;

use App\Modules\Identity\Enums\Locale;
use Database\Factories\Identity\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Le téléphone est l'identifiant réel : il est vérifié par OTP (§8) et sert de
 * clé de rattachement d'un propriétaire à ses véhicules (I3).
 *
 * Un passager de vente au guichet **n'a pas de compte** (I2) : ses coordonnées
 * vivent sur la réservation.
 */
final class User extends Authenticatable
{
    use HasApiTokens;

    /** @use HasFactory<UserFactory> */
    use HasFactory;

    use Notifiable;
    use SoftDeletes;

    protected $fillable = [
        'phone', 'email', 'first_name', 'last_name', 'locale',
    ];

    /** @var list<string> */
    protected $hidden = ['password', 'remember_token'];

    /** @var array<string, string> */
    protected $casts = [
        'password' => 'hashed',
        'locale' => Locale::class,
        'phone_verified_at' => 'immutable_datetime',
        'email_verified_at' => 'immutable_datetime',
        'last_login_at' => 'immutable_datetime',
        'is_active' => 'boolean',
    ];

    /** @return BelongsToMany<Role, $this> */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class)
            ->withPivot('agency_id')
            ->withTimestamps();
    }

    /**
     * Le rôle `AGENT` est porté **pour une agence donnée**. Sans cette portée,
     * un agent d'embarquement validerait les billets de toutes les agences de
     * la plateforme.
     */
    public function hasRole(string $role, ?int $agencyId = null): bool
    {
        return $this->roles()
            ->where('roles.name', $role)
            ->when(
                $agencyId !== null,
                fn ($query) => $query->wherePivot('agency_id', $agencyId),
                fn ($query) => $query->wherePivotNull('agency_id'),
            )
            ->exists();
    }

    public function fullName(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }
}
