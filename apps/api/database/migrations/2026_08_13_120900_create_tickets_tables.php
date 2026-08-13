<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();

            // Figure sur le billet et sert à la saisie manuelle en secours (B3).
            $table->string('reference', 20)->unique();

            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();

            // Un billet par passager.
            $table->foreignId('booking_passenger_id')->unique()->constrained()->cascadeOnDelete();

            // Dénormalisé, pour la liste d'embarquement.
            $table->foreignId('trip_id')->constrained()->restrictOnDelete();

            $table->string('qr_signature');
            $table->string('status', 20)->default('VALID');
            $table->timestampTz('issued_at');
            $table->timestampsTz();

            $table->index(['trip_id', 'status']);
        });

        /*
         * Validations à l'embarquement (B3).
         *
         * **Aucune contrainte d'unicité sur `ticket_id`.** Elle rejetterait le
         * doublon hors ligne au lieu de le tracer, et l'on perdrait
         * l'information qui permet de le diagnostiquer.
         *
         * La double validation hors ligne est un coût explicitement accepté :
         * deux agents disposant de la liste d'embarquement peuvent valider le
         * même billet. Le serveur la signale à la synchronisation plutôt que de
         * la bloquer — les deux agents relèvent de la même agence.
         */
        Schema::create('ticket_validations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('trip_id')->constrained()->restrictOnDelete();

            // Porteur du rôle AGENT.
            $table->foreignId('validated_by')->constrained('users')->restrictOnDelete();

            // Horodatage **local à l'appareil** : l'agent peut être hors ligne.
            $table->timestampTz('validated_at');

            $table->string('method', 10);
            $table->string('device_id', 100)->nullable();

            // Null tant que la validation est en file locale.
            $table->timestampTz('synced_at')->nullable();

            // Positionné à la synchronisation.
            $table->boolean('is_duplicate')->default(false);

            $table->timestampsTz();

            $table->index(['trip_id', 'validated_at']);
            $table->index('is_duplicate');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_validations');
        Schema::dropIfExists('tickets');
    }
};
