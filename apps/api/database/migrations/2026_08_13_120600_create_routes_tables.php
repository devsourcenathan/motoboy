<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Itinéraires, escales et horaires récurrents.
 *
 * Vocabulaire (annexe A du brief) : une `route` n'est **jamais datée**, un
 * `trip` l'est toujours.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('origin_city_id')->constrained('cities')->restrictOnDelete();
            $table->foreignId('destination_city_id')->constrained('cities')->restrictOnDelete();

            // Les gares sont portées par la route et surchargeables sur un
            // départ : une agence part de sa gare habituelle, l'exception reste
            // une exception. Cela évite aussi de réinscrire la gare sur chaque
            // départ généré (I1).
            $table->foreignId('origin_station_id')->constrained('stations')->restrictOnDelete();
            $table->foreignId('destination_station_id')->constrained('stations')->restrictOnDelete();

            $table->smallInteger('reference_duration_minutes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['origin_city_id', 'destination_city_id']);
        });

        /*
         * Escales **purement informatives** : la réservation est point-à-point
         * uniquement (B6). Aucune occupation par segment, aucun calcul de
         * disponibilité par tronçon, aucune grille tarifaire par segment — et
         * une ville d'escale ne rend pas un trajet éligible à une recherche qui
         * la viserait.
         */
        Schema::create('route_stops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('route_id')->constrained()->cascadeOnDelete();
            $table->foreignId('city_id')->constrained()->restrictOnDelete();
            $table->smallInteger('position');
            $table->timestampsTz();

            $table->unique(['route_id', 'position']);
        });

        /*
         * Niveau intermédiaire qui porte les horaires (I1).
         *
         * Distinct de la route parce qu'une même liaison porte souvent plusieurs
         * départs de nature différente : un VIP à 08:00 et un classique à 14:00
         * n'ont ni le même véhicule ni le même tarif.
         */
        Schema::create('schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('route_id')->constrained()->cascadeOnDelete();

            // Heure locale de pendule, pas un instant.
            $table->time('departure_time');

            // 1 = lundi.
            $table->json('days_of_week');

            $table->foreignId('default_vehicle_id')->nullable()->constrained('vehicles')->nullOnDelete();
            $table->foreignId('default_driver_id')->nullable()->constrained('drivers')->nullOnDelete();
            $table->bigInteger('price');
            $table->char('currency', 3)->default('XAF');
            $table->date('valid_from');
            $table->date('valid_until')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schedules');
        Schema::dropIfExists('route_stops');
        Schema::dropIfExists('routes');
    }
};
