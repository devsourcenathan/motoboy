<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gares et demandes de ville (B1 du brief).
 *
 * Une gare **appartient à une agence** : au Cameroun, les compagnies
 * interurbaines exploitent très majoritairement la leur. Deux agences installées
 * au même endroit produisent donc deux gares distinctes — conforme à la réalité
 * perçue par le passager, et sans liste canonique de lieux à curer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('city_id')->constrained()->restrictOnDelete();
            $table->string('name', 150);
            $table->text('address')->nullable();

            // Stockées dès le MVP même sans carte à l'écran : le stockage est
            // gratuit et la donnée devient exploitable au premier affichage
            // cartographique.
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();

            $table->boolean('is_active')->default(true);

            // Modération **a posteriori**, jamais bloquante : une validation
            // préalable bloquerait une agence motivée pour plusieurs jours.
            $table->timestampTz('moderated_at')->nullable();

            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['city_id', 'is_active']);
        });

        /*
         * Sans ce circuit, une agence desservant une ville absente du
         * référentiel est bloquée sans recours et abandonne.
         */
        Schema::create('city_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('country_id')->constrained()->restrictOnDelete();
            $table->string('requested_name', 120);
            $table->string('status', 20)->default('PENDING');
            $table->foreignId('resolved_city_id')->nullable()->constrained('cities')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('reviewed_at')->nullable();
            $table->timestampsTz();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('city_requests');
        Schema::dropIfExists('stations');
    }
};
