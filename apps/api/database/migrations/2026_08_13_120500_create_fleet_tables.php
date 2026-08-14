<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();

            // Rattachement par numéro de téléphone (I3). Le propriétaire accède
            // à un espace en **consultation seule** : aucun circuit financier ne
            // le relie à la plateforme.
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();

            // Le revenu d'un véhicule est une donnée commerciale de l'agence :
            // masqué par défaut, activable agence par agence.
            $table->boolean('owner_revenue_visible')->default(false);

            $table->string('registration', 20);
            $table->string('brand', 80)->nullable();
            $table->string('model', 80)->nullable();
            $table->string('type', 20);

            // Détermine le mécanisme d'inventaire — voir SeatingMode.
            $table->string('seating_mode', 15);

            $table->smallInteger('capacity');
            $table->string('condition', 20)->default('ACTIVE');
            $table->string('photo_path')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['agency_id', 'registration']);
        });

        // Uniquement pour les véhicules en mode SEATED.
        Schema::create('vehicle_seats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('label', 6);
            $table->smallInteger('row_index');
            $table->smallInteger('column_index');

            // Exclut le siège chauffeur ou un strapontin non vendable.
            $table->boolean('is_bookable')->default(true);

            $table->timestampsTz();

            $table->unique(['vehicle_id', 'label']);
        });

        Schema::create('vehicle_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('type', 50);
            $table->string('file_path');
            $table->date('expires_at')->nullable();
            $table->timestampsTz();
        });

        /*
         * Le chauffeur reste un acteur métier sans application dédiée (§3). Il
         * peut en revanche porter le rôle AGENT pour l'embarquement : le rôle
         * est fonctionnel, pas lié à un métier (B3).
         */
        Schema::create('drivers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('phone', 20);
            $table->string('license_number', 50);
            $table->date('license_expires_at')->nullable();
            $table->foreignId('assigned_vehicle_id')->nullable()->constrained('vehicles')->nullOnDelete();
            $table->string('status', 20)->default('ACTIVE');
            $table->timestampsTz();
            $table->softDeletesTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drivers');
        Schema::dropIfExists('vehicle_documents');
        Schema::dropIfExists('vehicle_seats');
        Schema::dropIfExists('vehicles');
    }
};
