<?php

declare(strict_types=1);

namespace Database\Factories\Identity;

use App\Modules\Identity\Enums\Locale;
use App\Modules\Identity\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * Les fabriques suivent la structure modulaire : `Database\Factories\{Module}`.
 *
 * La correspondance modèle → fabrique est réglée une fois dans
 * `AppServiceProvider`, puisque Laravel déduirait sinon
 * `Database\Factories\Modules\Identity\Models\UserFactory` du namespace du
 * modèle.
 *
 * @extends Factory<User>
 */
final class UserFactory extends Factory
{
    protected $model = User::class;

    /** Haché une seule fois : le hachage est lent par construction. */
    protected static ?string $password = null;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            // Le téléphone est l'identifiant réel (§8) : il doit rester unique
            // d'une fabrique à l'autre.
            'phone' => '+2376'.fake()->unique()->numerify('########'),
            'email' => fake()->unique()->safeEmail(),
            'password' => self::$password ??= Hash::make('password'),
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'locale' => Locale::French,
            'phone_verified_at' => now(),
            'is_active' => true,
        ];
    }

    public function unverified(): self
    {
        return $this->state(fn (): array => ['phone_verified_at' => null]);
    }

    /** Passager anglophone — Bamenda, Buea, Limbe (I10). */
    public function anglophone(): self
    {
        return $this->state(fn (): array => ['locale' => Locale::English]);
    }
}
