<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Le contrat impose `Idempotency-Key` sur la création de réservation, mais la
 * colonne manquait — `payments` et `refunds` l'avaient, pas `bookings`.
 *
 * Sans elle, un client dont la requête expire côté réseau et qui réessaie
 * crée une seconde réservation, immobilise une seconde place, et paie deux
 * fois. Sur une connexion mobile instable, ce n'est pas un cas rare.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            // Nullable : une vente au guichet est créée directement en
            // `CONFIRMED` par un agent, sans tunnel réseau à rejouer (I2).
            $table->string('idempotency_key', 100)->nullable()->unique()->after('reference');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('idempotency_key');
        });
    }
};
